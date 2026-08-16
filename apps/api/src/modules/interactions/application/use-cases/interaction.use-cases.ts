import { assertResourceInScope, type Role, type ScopeContext } from "@atlasmed/access";
import { AppError, ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { calendarLocalAnchorAt, calendarOccurrenceFromRecurrenceKey } from "../../../calendar/application/services/recurrence.service";
import { resolveClientInstant } from "../services/client-clock";
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

/**
 * A contact with no clinic (§15.7.5) has no facility for the scope check to
 * test, and "any interaction in the database" is not a scope. The record is the
 * rep's own, so ownership carries it: the checks below already require the actor
 * to be the agent, an admin, or their manager.
 */
function assertFacilityScope(record: InteractionDetailRecord, scope: ScopeContext): void {
  if (record.facilityId === null) return;
  assertResourceInScope(scope, "facility", record.facilityId);
}

function assertReadable(record: InteractionDetailRecord, actor: InteractionActor, scope: ScopeContext): void {
  assertFacilityScope(record, scope);
  if (record.agentUserId === actor.userId) return;
  if (actor.roleName === "ADMIN" && scope.isGlobal) return;
  if (actor.roleName === "MANAGER" && scope.managedUserIds.includes(record.agentUserId)) return;
  throw new ForbiddenError("Interaction is outside the current owner/team scope");
}

function assertOwner(record: InteractionDetailRecord, actor: InteractionActor, scope: ScopeContext): void {
  assertFacilityScope(record, scope);
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
    // Both nullable since §15.7.5, and never both null: an interaction is about
    // a clinic, a doctor, or the two together.
    facility: record.facility,
    person: record.person,
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
  async execute(input: { id: number; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string; startedAt?: string }) {
    const now = this.deps.now?.() ?? new Date();
    // §15.6.6-4: the device says when the rep arrived; receipt time is only a
    // fallback for a client that has not been taught to stamp.
    const startedAt = resolveClientInstant({ claimed: input.startedAt, now, field: "startedAt" });
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
      idempotencyKey: input.idempotencyKey, startedAt });
    if (!result) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    return toDto(result.interaction, input.actor, now);
  }
}

/**
 * "Cheguei" on a clinic's own page — spec 0016 §15.6.3.
 *
 * Reps improvise. A system that can only record its own suggestions will
 * under-count real work and then conclude reps are not visiting, so a visit to
 * a clinic that was never on the roteiro has to be recordable in one press.
 *
 * The calendar row it creates is bookkeeping, not a plan: its 60 minutes are a
 * placeholder for a visit already under way, and nothing reads them. What the
 * duration model learns comes from `actualStartedAt`/`actualEndedAt` and only
 * when the close was `MEASURED` (§15.6.2), so the placeholder cannot leak into
 * it.
 */
export class RecordArrivalUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: {
    facilityId: number;
    timeZone: string;
    actor: InteractionActor;
    scope: ScopeContext;
    idempotencyKey: string;
    startedAt?: string;
  }) {
    const now = this.deps.now?.() ?? new Date();
    // Stamped on the device: a rep who walks into a basement clinic and presses
    // Cheguei should not have the visit begin when they walk back out.
    const startedAt = resolveClientInstant({ claimed: input.startedAt, now, field: "startedAt" });
    const replay = await this.deps.repository.findArrival({ agentUserId: input.actor.userId, idempotencyKey: input.idempotencyKey });
    if (replay) return toDto(replay, input.actor, now);

    // A manager has no agenda of their own to record against, which is the
    // same rule that stops them creating calendar events.
    if (input.actor.roleName === "MANAGER") throw new ForbiddenError("Managers do not record their own visits");
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.repository.findFacilitySummary(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const anchor = calendarLocalAnchorAt(startedAt, input.timeZone);
    const record = await this.deps.repository.recordArrival({
      facilityId: input.facilityId,
      agentUserId: input.actor.userId,
      title: `Visita · ${facility.displayName}`,
      timeZone: input.timeZone,
      ...anchor,
      recurrenceKey: `${anchor.anchorLocalDate}T${anchor.anchorLocalTime}[${input.timeZone}]`,
      durationMinutes: ARRIVAL_PLACEHOLDER_MINUTES,
      startedAt,
      idempotencyKey: input.idempotencyKey,
    });
    return toDto(record, input.actor, now);
  }
}

/** Nominal length of the calendar row an arrival creates. Never learned from. */
const ARRIVAL_PLACEHOLDER_MINUTES = 60;

export class CompleteInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: number; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string; correctionReason?: string; completedAt?: string }) {
    const now = this.deps.now?.() ?? new Date();
    // The end is stamped by the device too: a completion that waits for signal
    // would otherwise inflate the duration by however long the wait was.
    const completedAt = resolveClientInstant({ claimed: input.completedAt, now, field: "completedAt" });
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
    const scheduledStartsAt = occurrence.startsAt < completedAt ? occurrence.startsAt : new Date(completedAt.getTime() - 1);
    const result = await this.deps.repository.complete({ id: input.id, actorUserId: input.actor.userId, expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey, completedAt,
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
