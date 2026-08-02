import type { Role, ScopeContext } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError, ValidationError, CalendarConflictError, CalendarVersionConflictError } from "../../../../shared/errors";
import type { CalendarEventRecord, CalendarRepository, InteractionModality } from "../interfaces/calendar.repository.interface";
import { findCalendarConflicts, type CalendarConflictEntry } from "../services/conflict.service";
import { calendarOccurrenceFromRecurrenceKey, expandCalendarOccurrences, type CalendarRecurrence, type CalendarRecurrenceRule } from "../services/recurrence.service";

interface Actor { userId: string; roleName: Role }
interface Dependencies { repository: CalendarRepository }
interface EventData {
  kind: "INTERACTION" | "PERSONAL_BLOCK";
  title: string;
  facilityId?: string;
  modality?: InteractionModality;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  recurrence: CalendarRecurrence;
  recurrenceUntil?: string;
  recurrenceCount?: number;
}

export interface CalendarOccurrenceDto {
  id: string;
  calendarId: string;
  recurrenceKey: string;
  ownerUserId: string;
  kind: "INTERACTION" | "PERSONAL_BLOCK";
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  durationMinutes: number;
  version: number;
  overrideVersion?: number;
  interaction?: { id: string; facilityId: string; modality: InteractionModality; status: string; version: number };
}

function assertOwnerRead(actor: Actor, scope: ScopeContext, ownerUserId?: string): string {
  const owner = ownerUserId ?? actor.userId;
  if (owner === actor.userId || scope.isGlobal) return owner;
  if (actor.roleName === "MANAGER" && scope.managedUserIds.includes(owner)) return owner;
  throw new ForbiddenError();
}

function assertMutationOwner(actor: Actor, event: CalendarEventRecord): void {
  if (actor.roleName === "MANAGER" || event.ownerUserId !== actor.userId) throw new ForbiddenError();
}

function ruleOf(event: CalendarEventRecord): CalendarRecurrenceRule {
  return {
    anchorLocalDate: event.anchorLocalDate,
    anchorLocalTime: event.anchorLocalTime.slice(0, 5),
    timeZone: event.timeZone,
    durationMinutes: event.durationMinutes,
    recurrence: event.recurrence,
    ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}),
    ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}),
  };
}

function entryOf(event: CalendarEventRecord): CalendarConflictEntry {
  return {
    id: event.id,
    rule: ruleOf(event),
    cancelledOccurrenceKeys: event.overrides.filter((item) => item.status === "CANCELLED").map((item) => item.recurrenceKey),
    overrides: Object.fromEntries(event.overrides.map((item) => [item.recurrenceKey, { status: item.status, startsAt: item.startsAt, endsAt: item.endsAt }])),
  };
}

function effectiveOccurrences(event: CalendarEventRecord, from: Date, to: Date) {
  const originals = new Map(expandCalendarOccurrences(ruleOf(event), { from, to }).map((occurrence) => [occurrence.recurrenceKey, occurrence]));
  for (const override of event.overrides) {
    if (!originals.has(override.recurrenceKey)) {
      const original = calendarOccurrenceFromRecurrenceKey(ruleOf(event), override.recurrenceKey);
      if (original) originals.set(override.recurrenceKey, original);
    }
  }
  return [...originals.values()].flatMap((occurrence) => {
    const override = event.overrides.find((candidate) => candidate.recurrenceKey === occurrence.recurrenceKey);
    if (override?.status === "CANCELLED") return [];
    const startsAt = override?.startsAt ?? occurrence.startsAt;
    const endsAt = override?.endsAt ?? occurrence.endsAt;
    return startsAt < to && endsAt > from ? [{ ...occurrence, startsAt, endsAt, override }] : [];
  });
}

function localAnchor(startsAt: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(startsAt);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function eventValues(ownerUserId: string, data: EventData) {
  const startsAt = new Date(data.startsAt);
  const anchor = localAnchor(startsAt, data.timeZone);
  return {
    ownerUserId, kind: data.kind, title: data.title.trim(), anchorLocalDate: anchor.date,
    anchorLocalTime: anchor.time, timeZone: data.timeZone, durationMinutes: data.durationMinutes,
    firstStartsAt: startsAt, firstEndsAt: new Date(startsAt.getTime() + data.durationMinutes * 60_000),
    recurrence: data.recurrence, recurrenceUntil: data.recurrenceUntil ?? null, recurrenceCount: data.recurrenceCount ?? null,
  };
}

async function loadOwned(repository: CalendarRepository, id: string, actor: Actor) {
  const event = await repository.findById(id);
  if (!event) throw new ResourceNotFoundError("Calendar", id);
  assertMutationOwner(actor, event);
  return event;
}

function conflictFrom(event: ReturnType<typeof eventValues>, id: string): CalendarConflictEntry {
  return { id, rule: { anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime,
    timeZone: event.timeZone, durationMinutes: event.durationMinutes, recurrence: event.recurrence,
    ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}),
    ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) } };
}

export class CreateCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; idempotencyKey: string; data: EventData }) {
    if (input.actor.roleName === "MANAGER") throw new ForbiddenError();
    if (input.data.kind === "INTERACTION" && (!input.scope.isGlobal && !input.scope.facilityIds.includes(input.data.facilityId!))) throw new ForbiddenError();
    const event = eventValues(input.actor.userId, input.data);
    return this.deps.repository.runWithOwnerLock(input.actor.userId, async (repository) => {
      const existing = await repository.listConflictEntries(input.actor.userId);
      const candidate = conflictFrom(event, `candidate:${input.idempotencyKey}`);
      const conflicts = findCalendarConflicts(candidate, existing, { from: event.firstStartsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      const firstOccurrence = expandCalendarOccurrences(candidate.rule, { from: new Date(event.firstStartsAt.getTime() - 1), to: new Date(event.firstEndsAt.getTime() + 1) })[0]!;
      return repository.create({ commandKey: input.idempotencyKey, event,
        ...(input.data.kind === "INTERACTION" ? { interaction: { recurrenceKey: firstOccurrence.recurrenceKey,
          facilityId: input.data.facilityId!, agentUserId: input.actor.userId, modality: input.data.modality! } } : {}) });
    });
  }
}

export class ListCalendarUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; ownerUserId?: string; from: Date; to: Date }) {
    const owner = assertOwnerRead(input.actor, input.scope, input.ownerUserId);
    const managerView = input.actor.roleName === "MANAGER" && owner !== input.actor.userId;
    const events = await this.deps.repository.listByOwner(owner);
    return events.flatMap((event): CalendarOccurrenceDto[] => effectiveOccurrences(event, input.from, input.to).flatMap((occurrence) => {
      const interaction = event.interactions.find((item) => item.recurrenceKey === occurrence.recurrenceKey) ?? event.interactions[0];
      if (event.kind === "INTERACTION" && (!interaction || (managerView && !input.scope.isGlobal && !input.scope.facilityIds.includes(interaction.facilityId)))) return [];
      if (interaction?.status === "CANCELLED") return [];
      return [{ id: `${event.id}:${occurrence.recurrenceKey}`, calendarId: event.id, recurrenceKey: occurrence.recurrenceKey,
        ownerUserId: event.ownerUserId, kind: event.kind, title: managerView && event.kind === "PERSONAL_BLOCK" ? "Indisponível" : event.title,
        startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), timeZone: event.timeZone,
        durationMinutes: Math.round((occurrence.endsAt.getTime() - occurrence.startsAt.getTime()) / 60_000), version: event.version,
        ...(occurrence.override ? { overrideVersion: occurrence.override.version } : {}),
        ...(interaction ? { interaction: { id: interaction.id, facilityId: interaction.facilityId, modality: interaction.modality,
          status: interaction.status, version: interaction.version } } : {}) }];
    })).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  }
}

export class GetCalendarAvailabilityUseCase {
  private readonly list: ListCalendarUseCase;
  constructor(deps: Dependencies) { this.list = new ListCalendarUseCase(deps); }
  async execute(input: { actor: Actor; scope: ScopeContext; ownerUserId?: string; from: Date; to: Date }) {
    return (await this.list.execute(input)).map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
  }
}

export class UpdateCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: string; idempotencyKey: string; expectedVersion: number;
    changes: Partial<{ title: string; startsAt: string; timeZone: string; durationMinutes: number; recurrence: CalendarRecurrence; recurrenceUntil: string | null; recurrenceCount: number | null }> }) {
    const current = await loadOwned(this.deps.repository, input.id, input.actor);
    return this.deps.repository.runWithOwnerLock(current.ownerUserId, async (repository) => {
      const nextData: EventData = { kind: current.kind, title: input.changes.title ?? current.title,
        startsAt: input.changes.startsAt ?? current.firstStartsAt.toISOString(), timeZone: input.changes.timeZone ?? current.timeZone,
        durationMinutes: input.changes.durationMinutes ?? current.durationMinutes, recurrence: input.changes.recurrence ?? current.recurrence,
        recurrenceUntil: input.changes.recurrenceUntil === null ? undefined : input.changes.recurrenceUntil ?? current.recurrenceUntil ?? undefined,
        recurrenceCount: input.changes.recurrenceCount === null ? undefined : input.changes.recurrenceCount ?? current.recurrenceCount ?? undefined };
      const values = eventValues(current.ownerUserId, nextData);
      const conflicts = findCalendarConflicts(conflictFrom(values, current.id), await repository.listConflictEntries(current.ownerUserId, current.id), { from: values.firstStartsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      const updated = await repository.update({ id: current.id, expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey, changes: values });
      if (!updated) throw new CalendarVersionConflictError(current.id, input.expectedVersion);
      return updated;
    });
  }
}

export class UpdateCalendarOccurrenceUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: string; recurrenceKey: string; idempotencyKey: string; expectedVersion: number; startsAt: string; durationMinutes: number }) {
    const event = await loadOwned(this.deps.repository, input.id, input.actor);
    const original = calendarOccurrenceFromRecurrenceKey(ruleOf(event), input.recurrenceKey);
    if (!original) throw new ResourceNotFoundError("CalendarOccurrence", input.recurrenceKey);
    const interaction = event.interactions.find((item) => item.recurrenceKey === input.recurrenceKey) ?? event.interactions[0];
    if (event.kind === "INTERACTION" && interaction?.status !== "SCHEDULED") throw new ValidationError([{ field: "recurrenceKey", message: "Only scheduled interaction occurrences may be rescheduled" }]);
    const startsAt = new Date(input.startsAt); const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
    return this.deps.repository.runWithOwnerLock(event.ownerUserId, async (repository) => {
      const candidate: CalendarConflictEntry = { id: event.id, rule: { anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime,
        timeZone: event.timeZone, durationMinutes: event.durationMinutes, recurrence: event.recurrence,
        ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}), ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) },
        overrides: { [input.recurrenceKey]: { status: "ACTIVE", startsAt, endsAt } } };
      const conflicts = findCalendarConflicts(candidate, await repository.listConflictEntries(event.ownerUserId, event.id), { from: startsAt, to: endsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      const result = await repository.upsertOverride({ calendarId: event.id, recurrenceKey: input.recurrenceKey, startsAt, endsAt,
        status: "ACTIVE", expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey });
      if (!result) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
      return result;
    });
  }
}

function reason(value: string) { const trimmed = value.trim(); if (!trimmed) throw new ValidationError([{ field: "reason", message: "Cancellation reason is required" }]); return trimmed; }

export class CancelCalendarOccurrenceUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: string; recurrenceKey: string; idempotencyKey: string; expectedVersion: number; reason: string }) {
    const event = await loadOwned(this.deps.repository, input.id, input.actor);
    const original = calendarOccurrenceFromRecurrenceKey(ruleOf(event), input.recurrenceKey);
    if (!original) throw new ResourceNotFoundError("CalendarOccurrence", input.recurrenceKey);
    const interaction = event.interactions.find((item) => item.recurrenceKey === input.recurrenceKey) ?? event.interactions[0];
    if (event.kind === "INTERACTION" && interaction?.status !== "SCHEDULED") throw new ValidationError([{ field: "recurrenceKey", message: "Only scheduled interaction occurrences may be cancelled" }]);
    const result = await this.deps.repository.runWithOwnerLock(event.ownerUserId, (repository) => repository.upsertOverride({
      calendarId: event.id, recurrenceKey: input.recurrenceKey, startsAt: original.startsAt, endsAt: original.endsAt,
      status: "CANCELLED", reason: reason(input.reason), expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey }));
    if (!result) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
    return result;
  }
}

export class CancelCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: string; idempotencyKey: string; expectedVersion: number; reason: string }) {
    const event = await loadOwned(this.deps.repository, input.id, input.actor);
    if (event.kind === "INTERACTION" && event.interactions.some((item) => item.status !== "SCHEDULED")) throw new ValidationError([{ field: "id", message: "Only scheduled interaction series may be cancelled" }]);
    const ok = await this.deps.repository.runWithOwnerLock(event.ownerUserId, (repository) => repository.delete({ id: event.id,
      expectedVersion: input.expectedVersion, reason: reason(input.reason), commandKey: input.idempotencyKey }));
    if (!ok) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
    return { id: event.id, cancelled: true };
  }
}
