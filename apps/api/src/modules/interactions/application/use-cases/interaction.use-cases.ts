import { assertResourceInScope, type Role, type ScopeContext } from "@atlasmed/access";
import { AppError, ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { calendarOccurrenceFromRecurrenceKey } from "../../../calendar/application/services/recurrence.service";
import type {
  InteractionDetailRecord,
  InteractionRepository,
  InteractionStatus,
} from "../interfaces/interaction.repository.interface";

export interface InteractionActor {
  userId: string;
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

function toDto(record: InteractionDetailRecord, actor: InteractionActor) {
  const occurrence = effectiveOccurrence(record);
  return {
    id: record.id,
    calendarId: record.calendarId,
    recurrenceKey: record.recurrenceKey,
    modality: record.modality,
    status: record.status,
    actualStartedAt: record.actualStartedAt?.toISOString() ?? null,
    actualEndedAt: record.actualEndedAt?.toISOString() ?? null,
    correctedAt: record.correctedAt?.toISOString() ?? null,
    correctedByUserId: record.correctedByUserId,
    correctionReason: record.correctionReason,
    visitId: record.visitId,
    version: record.version,
    calendar: { id: record.calendarId, title: record.calendar.title },
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
    canMutate: record.agentUserId === actor.userId && record.calendar.ownerUserId === actor.userId,
  };
}

export class GetInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: string; actor: InteractionActor; scope: ScopeContext }) {
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertReadable(record, input.actor, input.scope);
    return toDto(record, input.actor);
  }
}

export class StartInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: string; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string }) {
    const replay = await this.deps.repository.findCommandResult({ id: input.id, command: "start", idempotencyKey: input.idempotencyKey });
    if (replay) {
      assertOwner(replay, input.actor, input.scope);
      return toDto(replay, input.actor);
    }
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertOwner(record, input.actor, input.scope);
    if (record.status !== "SCHEDULED") throw new InteractionTransitionError(record.status, "IN_PROGRESS");
    if (record.version !== input.expectedVersion) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    const result = await this.deps.repository.start({ id: input.id, actorUserId: input.actor.userId, expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey, startedAt: this.deps.now?.() ?? new Date() });
    if (!result) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    return toDto(result.interaction, input.actor);
  }
}

export class CompleteInteractionUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { id: string; actor: InteractionActor; scope: ScopeContext; expectedVersion: number; idempotencyKey: string; correctionReason?: string }) {
    const replay = await this.deps.repository.findCommandResult({ id: input.id, command: "complete", idempotencyKey: input.idempotencyKey });
    if (replay) {
      assertOwner(replay, input.actor, input.scope);
      return toDto(replay, input.actor);
    }
    const record = await this.deps.repository.findById(input.id);
    if (!record) throw new ResourceNotFoundError("Interaction", input.id);
    assertOwner(record, input.actor, input.scope);
    if (record.status !== "IN_PROGRESS" && record.status !== "NOT_COMPLETED") throw new InteractionTransitionError(record.status, "COMPLETED");
    const correctionReason = input.correctionReason?.trim();
    if (record.status === "NOT_COMPLETED" && !correctionReason) {
      throw new ValidationError([{ field: "correctionReason", message: "correctionReason is required when correcting a missed interaction" }]);
    }
    if (record.version !== input.expectedVersion) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    const result = await this.deps.repository.complete({ id: input.id, actorUserId: input.actor.userId, expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey, completedAt: this.deps.now?.() ?? new Date(), ...(correctionReason ? { correctionReason } : {}) });
    if (!result) throw new InteractionVersionConflictError(input.expectedVersion, record.version);
    return toDto(result.interaction, input.actor);
  }
}

export class MarkOverdueInteractionsUseCase {
  constructor(private readonly deps: Dependencies & { systemActorUserId?: string | null }) {}
  async execute(input: { now?: Date; limit?: number } = {}) {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    return this.deps.repository.markOverdue({ now: input.now ?? this.deps.now?.() ?? new Date(), limit, actorUserId: this.deps.systemActorUserId ?? null });
  }
}
