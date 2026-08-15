import { assertResourceInScope, type Role, type ScopeContext } from "@atlasmed/access";
import { AppError, ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { calendarOccurrenceFromRecurrenceKey } from "../../../calendar/application/services/recurrence.service";
import type {
  InteractionDetailRecord,
  InteractionRepository,
  InteractionStatus,
  InteractionFollowUp,
  InteractionOutcome,
} from "../interfaces/interaction.repository.interface";

export interface InteractionActor {
  userId: number;
  roleName: Role;
}

export class InteractionTransitionError extends AppError {
  constructor(from: InteractionStatus, to: InteractionStatus) {
    super("INTERACTION_INVALID_TRANSITION", 409, `Interaction cannot transition from ${from} to ${to}`, { from, to });
  }
}

export class InteractionVersionConflictError extends AppError {
  constructor(expectedVersion: number, actualVersion: number) {
    super("INTERACTION_VERSION_CONFLICT", 409, "Interaction version conflict", { expectedVersion, actualVersion });
  }
}

interface Dependencies {
  repository: InteractionRepository;
  now?: () => Date;
}

function assertReadable(record: InteractionDetailRecord, actor: InteractionActor, scope: ScopeContext): void {
  assertResourceInScope(scope, "facility", record.facilityId);
  if (record.agentUserId === actor.userId) return;
  if (actor.roleName === "ADMIN" && scope.isGlobal) return;
  if (actor.roleName === "MANAGER" && scope.managedUserIds.includes(record.agentUserId)) return;
  throw new ForbiddenError("Interaction is outside the current owner/team scope");
}

function assertOwner(record: InteractionDetailRecord, actor: InteractionActor, scope: ScopeContext): void {
  assertResourceInScope(scope, "facility", record.facilityId);
  if (record.agentUserId !== actor.userId || record.calendar.ownerUserId !== actor.userId) {
    throw new ForbiddenError("Only the interaction owner may change its lifecycle");
  }
}

function effectiveOccurrence(record: InteractionDetailRecord) {
  const occurrence = calendarOccurrenceFromRecurrenceKey(
    {
      anchorLocalDate: record.calendar.anchorLocalDate,
      anchorLocalTime: record.calendar.anchorLocalTime,
      timeZone: record.calendar.timeZone,
      durationMinutes: record.calendar.durationMinutes,
      recurrence: record.calendar.recurrence,
      ...(record.calendar.recurrenceUntil ? { recurrenceUntil: record.calendar.recurrenceUntil } : {}),
      ...(record.calendar.recurrenceCount ? { recurrenceCount: record.calendar.recurrenceCount } : {}),
    },
    record.recurrenceKey,
  );
  if (!occurrence) throw new ResourceNotFoundError("Calendar occurrence", record.recurrenceKey);
  return record.occurrenceOverride?.status === "ACTIVE"
    ? { ...occurrence, startsAt: record.occurrenceOverride.startsAt, endsAt: record.occurrenceOverride.endsAt }
    : occurrence;
}

function effectiveStatus(record: InteractionDetailRecord, occurrence: ReturnType<typeof effectiveOccurrence>, now: Date): InteractionStatus {
  if (record.status !== "SCHEDULED") return record.status;
  if (record.calendar.status === "CANCELLED" || record.occurrenceOverride?.status === "CANCELLED") return "CANCELLED";
  return occurrence.endsAt <= now ? "NOT_COMPLETED" : "SCHEDULED";
}

function toDto(record: InteractionDetailRecord, actor: InteractionActor, now: Date) {
  const occurrence = effectiveOccurrence(record);
  const status = effectiveStatus(record, occurrence, now);
  const canMutate = record.agentUserId === actor.userId && record.calendar.ownerUserId === actor.userId && status !== "CANCELLED";
  return {
    id: record.id,
    calendarId: record.calendarId,
    recurrenceKey: record.recurrenceKey,
    modality: record.modality,
    status,
    actualStartedAt: record.actualStartedAt?.toISOString() ?? null,
    actualEndedAt: record.actualEndedAt?.toISOString() ?? null,
    outcome: record.outcome,
    followUp: record.followUp,
    outcomeAnsweredAt: record.outcomeAnsweredAt?.toISOString() ?? null,
    // The client needs to know *whether to ask*, and "completed with no answer"
    // is the only state where the questions are worth putting on screen.
    needsOutcome: status === "COMPLETED" && record.outcome === null,
    correctedAt: record.correctedAt?.toISOString() ?? null,
    correctedByUserId: record.correctedByUserId,
    correctionReason: record.correctionReason,
    visitId: record.visitId,
    version: record.version,
    calendarVersion: record.calendar.version,
    overrideVersion: record.occurrenceOverride?.version ?? null,
    calendar: { id: record.calendarId, title: record.calendar.title, version: record.calendar.version,
      recurrence: record.calendar.recurrence, recurrenceUntil: record.calendar.recurrenceUntil,
      recurrenceCount: record.calendar.recurrenceCount },
    occurrence: {
      recurrenceKey: record.recurrenceKey,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      timeZone: record.calendar.timeZone,
    },
    facility: record.facility,
    agent: {
      ...record.agent,
      displayName: [record.agent.firstName, record.agent.lastName].filter(Boolean).join(" ") || record.agent.id,
    },
    linkedOrders: record.linkedOrders.map((order) => ({ ...order, orderedAt: order.orderedAt.toISOString() })),
    canMutate,
  };
}

export class GetInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: number; actor: InteractionActor; scope: ScopeContext }) {
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertReadable(record, input.actor, input.scope);
    return toDto(record, input.actor, this.deps.now?.() ?? new Date());
  }
}

export class StartInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: number; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string }) {
    const now = this.deps.now?.() ?? new Date();
    const replay = await this.deps.repository.findCommandResult({ id: input.id, command: "start", idempotencyKey: input.idempotencyKey });
    if (replay) {
      assertOwner(replay, input.actor, input.scope);
      return toDto(replay, input.actor, now);
    }
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertOwner(record, input.actor, input.scope);
    const occurrence = effectiveOccurrence(record);
    const status = effectiveStatus(record, occurrence, now);
    if (status !== "SCHEDULED") throw new InteractionTransitionError(status, "IN_PROGRESS");
    if (record.version !== input.expectedVersion) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    const result = await this.deps.repository.start({ id: input.id, actorUserId: input.actor.userId, expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey, startedAt: now });
    if (!result) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    return toDto(result.interaction, input.actor, now);
  }
}

export class CompleteInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: number; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string; correctionReason?: string }) {
    const now = this.deps.now?.() ?? new Date();
    const replay = await this.deps.repository.findCommandResult({ id: input.id, command: "complete", idempotencyKey: input.idempotencyKey });
    if (replay) {
      assertOwner(replay, input.actor, input.scope);
      return toDto(replay, input.actor, now);
    }
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertOwner(record, input.actor, input.scope);
    const occurrence = effectiveOccurrence(record);
    const status = effectiveStatus(record, occurrence, now);
    if (status !== "IN_PROGRESS" && status !== "NOT_COMPLETED") throw new InteractionTransitionError(status, "COMPLETED");
    const correctionReason = input.correctionReason?.trim();
    if (status === "NOT_COMPLETED" && !correctionReason) {
      throw new ValidationError([{ field: "correctionReason", message: "correctionReason is required when correcting a missed interaction" }]);
    }
    if (record.version !== input.expectedVersion) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    const scheduledStartsAt = occurrence.startsAt < now ? occurrence.startsAt : new Date(now.getTime() - 1);
    const result = await this.deps.repository.complete({ id: input.id, actorUserId: input.actor.userId, expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey, completedAt: now,
      ...(status === "NOT_COMPLETED" ? { scheduledStartsAt } : {}),
      ...(record.status === "SCHEDULED" && status === "NOT_COMPLETED" ? { persistEffectiveMissed: true } : {}),
      ...(correctionReason ? { correctionReason } : {}) });
    if (!result) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    return toDto(result.interaction, input.actor, now);
  }
}

/**
 * Gives up on visits the rep walked away from — spec 0016 §15.6.1.
 *
 * Runs beside the overdue job rather than inside it: that one decides a
 * *scheduled* visit never happened, this one decides an *open* visit is over.
 * Different questions, different statuses, and merging them would make one
 * job's failure hide the other's work.
 */
export class CloseStaleVisitsUseCase {
  constructor(private readonly deps: Dependencies & { systemActorUserId?: number | null }) {}
  async execute(input: { now?: Date; limit?: number } = {}) {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    return this.deps.repository.closeStaleVisits({ now: input.now ?? this.deps.now?.() ?? new Date(), limit, actorUserId: this.deps.systemActorUserId ?? null });
  }
}

/**
 * Records the two questions asked on the way out — spec 0016 §15.6.4.
 *
 * Its own use case rather than an argument to `complete`, because most visits
 * are not closed by the rep at all: an arrival closes one, the workday-end job
 * closes another, and the answers arrive after the fact either way.
 */
export class RecordInteractionOutcomeUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: {
    id: number;
    actor: InteractionActor;
    scope: ScopeContext;
    outcome: InteractionOutcome;
    followUp: InteractionFollowUp;
  }) {
    const now = this.deps.now?.() ?? new Date();
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertOwner(record, input.actor, input.scope);
    const updated = await this.deps.repository.recordOutcome({
      id: input.id,
      actorUserId: input.actor.userId,
      outcome: input.outcome,
      followUp: input.followUp,
      answeredAt: now,
    });
    if (!updated) throw new InteractionTransitionError(effectiveStatus(record, effectiveOccurrence(record), now), "COMPLETED");
    return toDto(updated, input.actor, now);
  }
}

export class MarkOverdueInteractionsUseCase {
  constructor(private readonly deps: Dependencies & { systemActorUserId?: number | null }) {}
  async execute(input: { now?: Date; limit?: number } = {}) {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    return this.deps.repository.markOverdue({ now: input.now ?? this.deps.now?.() ?? new Date(), limit, actorUserId: this.deps.systemActorUserId ?? null });
  }
}
