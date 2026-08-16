import type { Role, ScopeContext } from "@atlasmed/access";
import { AppError, ForbiddenError, ResourceNotFoundError, ValidationError, CalendarConflictError, CalendarVersionConflictError } from "../../../../shared/errors";
import type { CalendarEventRecord, CalendarInteractionRecord, CalendarOverrideRecord, CalendarRepository, InteractionModality } from "../interfaces/calendar.repository.interface";
import { missedAfter } from "../../../interactions/application/services/day-window";
import { findCalendarConflicts, type CalendarConflictEntry } from "../services/conflict.service";
import { calendarOccurrenceFromRecurrenceKey, expandCalendarOccurrences, mapCalendarRecurrenceKey, type CalendarRecurrence, type CalendarRecurrenceRule } from "../services/recurrence.service";

export class CalendarIdempotencyConflictError extends AppError {
  constructor() {
    super("CALENDAR_IDEMPOTENCY_CONFLICT", 409, "Idempotency key was already used for a different calendar command");
  }
}

interface Actor { userId: number; roleName: Role }
interface Dependencies { repository: CalendarRepository; now?: () => Date }
interface EventData {
  kind: "INTERACTION" | "PERSONAL_BLOCK";
  title: string;
  facilityId?: number;
  /** §15.7.5 — the doctor, when the rep is booking a person rather than a place. */
  personId?: number;
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
  calendarId: number;
  recurrenceKey: string;
  ownerUserId: number;
  kind: "INTERACTION" | "PERSONAL_BLOCK";
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  durationMinutes: number;
  recurrence: CalendarRecurrence;
  recurrenceUntil: string | null;
  recurrenceCount: number | null;
  /** Where the series starts — not this occurrence. */
  anchorLocalDate: string;
  anchorLocalTime: string;
  version: number;
  calendarVersion: number;
  overrideVersion?: number;
  owner: { id: number; name: string };
  facility: { id: number; name: string } | null;
  canMutate: boolean;
  /**
   * `actualStartedAt`/`actualEndedAt` are what the visit *was*, against a
   * `startsAt`/`endsAt` that stay what it was *planned* to be (§15.6.3). The day
   * grid needs both: an arrival books a 60-minute placeholder, so without the
   * measured pair three improvised five-minute visits draw as three overlapping
   * hours and the rep's afternoon reads as full.
   */
  interaction?: { id: number; facilityId: number | null; person: { id: number; name: string } | null;
    modality: InteractionModality; status: string; version: number; missReason: string | null;
    actualStartedAt: string | null; actualEndedAt: string | null };
}

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5_000;

function assertRange(from: Date, to: Date): void {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    throw new ValidationError([{ field: "to", message: "to must be after from" }]);
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new ValidationError([{ field: "to", message: "Calendar range may not exceed 366 days" }]);
  }
}

function assertOwnerRead(actor: Actor, scope: ScopeContext, ownerUserId?: number): number {
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

function entryOf(event: CalendarEventRecord, cancelledExtra: string[] = []): CalendarConflictEntry {
  return {
    id: event.id,
    rule: ruleOf(event),
    cancelledOccurrenceKeys: [
      ...event.overrides.filter((item) => item.status === "CANCELLED").map((item) => item.recurrenceKey),
      ...cancelledExtra,
    ],
    overrides: Object.fromEntries(event.overrides.map((item) => [item.recurrenceKey, { status: item.status, startsAt: item.startsAt, endsAt: item.endsAt }])),
  };
}

function effectiveOccurrences(event: CalendarEventRecord, from: Date, to: Date) {
  if (event.status === "CANCELLED") return [];
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

function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(0); return true; } catch { return false; }
}

function localAnchor(startsAt: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(startsAt);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function validateEventData(data: EventData): void {
  const issues: Array<{ field: string; message: string }> = [];
  const startsAt = new Date(data.startsAt);
  if (!Number.isFinite(startsAt.getTime())) issues.push({ field: "startsAt", message: "startsAt must be a valid timestamp" });
  if (!validTimeZone(data.timeZone)) issues.push({ field: "timeZone", message: "Invalid IANA time zone" });
  if (!Number.isInteger(data.durationMinutes) || data.durationMinutes <= 0 || data.durationMinutes % 30 !== 0) {
    issues.push({ field: "durationMinutes", message: "durationMinutes must be a positive multiple of 30" });
  }
  if (data.recurrenceUntil && data.recurrenceCount) issues.push({ field: "recurrenceUntil", message: "recurrenceUntil and recurrenceCount are mutually exclusive" });
  if (data.recurrence === "NONE" && (data.recurrenceUntil || data.recurrenceCount)) issues.push({ field: "recurrence", message: "NONE recurrence cannot have bounds" });
  if (Number.isFinite(startsAt.getTime()) && validTimeZone(data.timeZone) && data.recurrenceUntil) {
    const anchor = localAnchor(startsAt, data.timeZone);
    if (data.recurrenceUntil < anchor.date) issues.push({ field: "recurrenceUntil", message: "recurrenceUntil must be on or after the anchor date" });
  }
  if (issues.length) throw new ValidationError(issues);
}

/**
 * Who and where an interaction is about — **create only**.
 *
 * Deliberately not part of `validateEventData`, which every reschedule also
 * runs: an occurrence update carries the times and nothing else, so folding
 * these in there rejected every reschedule for having no subject it was never
 * asked to change.
 *
 * Says the same thing the table's check says (§15.7.5), so the rep gets a
 * message instead of a constraint violation.
 *
 * **Modality no longer decides this.** An in-person meeting with a doctor need
 * not be at a clinic — a coffee, a corridor at a congress, a hospital the rep's
 * book has never heard of. Requiring a clinic there only produced a wrong one.
 */
function validateSubject(data: EventData): void {
  const issues: Array<{ field: string; message: string }> = [];
  if (data.kind === "INTERACTION") {
    if (data.facilityId === undefined && data.personId === undefined) {
      issues.push({ field: "facilityId", message: "An interaction needs a clinic, a person, or both" });
    }
  } else if (data.personId !== undefined) {
    issues.push({ field: "personId", message: "A personal block is not about anybody" });
  }
  if (issues.length) throw new ValidationError(issues);
}

function eventValues(ownerUserId: number, data: EventData) {
  validateEventData(data);
  const startsAt = new Date(data.startsAt);
  const anchor = localAnchor(startsAt, data.timeZone);
  return {
    ownerUserId, kind: data.kind, title: data.title.trim(), anchorLocalDate: anchor.date,
    anchorLocalTime: anchor.time, timeZone: data.timeZone, durationMinutes: data.durationMinutes,
    firstStartsAt: startsAt, firstEndsAt: new Date(startsAt.getTime() + data.durationMinutes * 60_000),
    recurrence: data.recurrence, recurrenceUntil: data.recurrenceUntil ?? null, recurrenceCount: data.recurrenceCount ?? null,
  };
}

async function loadOwned(repository: CalendarRepository, id: number, actor: Actor) {
  const event = await repository.findById(id);
  if (!event) throw new ResourceNotFoundError("Calendar", id);
  assertMutationOwner(actor, event);
  return event;
}

function firstStartsAt(event: CalendarEventRecord): Date {
  if (event.firstStartsAt) return event.firstStartsAt;
  const first = expandCalendarOccurrences(ruleOf(event), { from: new Date(0), to: new Date("9999-12-31T23:59:59.999Z") })[0];
  if (!first) throw new ValidationError([{ field: "startsAt", message: "Historical calendar row has no valid first occurrence" }]);
  return first.startsAt;
}

function conflictFrom(event: ReturnType<typeof eventValues>, id: number | string, overrides: CalendarEventRecord["overrides"] = []): CalendarConflictEntry {
  return { id, rule: { anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime,
    timeZone: event.timeZone, durationMinutes: event.durationMinutes, recurrence: event.recurrence,
    ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}),
    ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) },
    cancelledOccurrenceKeys: overrides.filter((item) => item.status === "CANCELLED").map((item) => item.recurrenceKey),
    overrides: Object.fromEntries(overrides.map((item) => [item.recurrenceKey, { status: item.status, startsAt: item.startsAt, endsAt: item.endsAt }])),
  };
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}
function commandFingerprint(commandKind: string, resourceId: number | null, expectedVersion: number | null, payload: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(canonicalize({ commandKind, resourceId, expectedVersion, payload }))).digest("hex");
}
function replayResult<T>(receipt: { commandKind: string; resourceId: number | null; requestFingerprint: string; result: T } | undefined,
  commandKind: string, resourceId: number | null, requestFingerprint: string): T | undefined {
  if (!receipt) return undefined;
  if (receipt.commandKind !== commandKind || receipt.resourceId !== resourceId || receipt.requestFingerprint !== requestFingerprint) {
    throw new CalendarIdempotencyConflictError();
  }
  return receipt.result;
}

function receiptEvent(value: CalendarEventRecord): CalendarEventRecord {
  return { ...value,
    firstStartsAt: value.firstStartsAt ? new Date(value.firstStartsAt) : null,
    firstEndsAt: value.firstEndsAt ? new Date(value.firstEndsAt) : null,
    cancelledAt: value.cancelledAt ? new Date(value.cancelledAt) : null,
    overrides: value.overrides.map((item) => ({ ...item, startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt) })),
  };
}
function receiptOverride(value: CalendarOverrideRecord): CalendarOverrideRecord {
  return { ...value, startsAt: new Date(value.startsAt), endsAt: new Date(value.endsAt) };
}

export class CreateCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; idempotencyKey: string; data: EventData }) {
    if (input.actor.roleName === "MANAGER") throw new ForbiddenError();
    validateSubject(input.data);
    const event = eventValues(input.actor.userId, input.data);
    if (input.data.kind === "INTERACTION") await this.assertSubjectInScope(input.scope, input.data);
    const commandKind = "CREATE";
    const fingerprint = commandFingerprint(commandKind, null, null, input.data);
    return this.deps.repository.runWithOwnerLock(input.actor.userId, async (repository) => {
      const replay = replayResult(await repository.getCommandReceipt<CalendarEventRecord>(input.actor.userId, input.idempotencyKey), commandKind, null, fingerprint);
      if (replay) return receiptEvent(replay);
      const existing = await repository.listConflictEntries(input.actor.userId, undefined, { from: event.firstStartsAt });
      const candidate = conflictFrom(event, `candidate:${input.idempotencyKey}`);
      const conflicts = findCalendarConflicts(candidate, existing, { from: event.firstStartsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      const firstOccurrence = expandCalendarOccurrences(candidate.rule, { from: new Date(event.firstStartsAt.getTime() - 1), to: new Date(event.firstEndsAt.getTime() + 1) })[0]!;
      const created = await repository.create({ commandKey: input.idempotencyKey, event,
        ...(input.data.kind === "INTERACTION" ? { interaction: { recurrenceKey: firstOccurrence.recurrenceKey,
          facilityId: input.data.facilityId ?? null, personId: input.data.personId ?? null,
          agentUserId: input.actor.userId, modality: input.data.modality! } } : {}) });
      return (await repository.saveCommandReceipt(input.actor.userId, input.idempotencyKey, commandKind, null, fingerprint, created)).result;
    });
  }

  /**
   * §15.7.5 — who a rep may book, when the booking may name no clinic.
   *
   * A clinic is checked the way it always was. A person is checked through the
   * clinics they work at: permissions are facility-based, so a contact with no
   * facility would otherwise arrive with nothing for them to bite on, and "any
   * person in the database" is not a scope. One clinic in the rep's own book is
   * enough — that is what makes the doctor theirs to talk to.
   */
  private async assertSubjectInScope(scope: ScopeContext, data: EventData): Promise<void> {
    if (scope.isGlobal) return;
    if (data.facilityId !== undefined) {
      if (!scope.facilityIds.includes(data.facilityId)) throw new ForbiddenError();
      return;
    }
    const facilityIds = await this.deps.repository.listPersonFacilityIds(data.personId!);
    if (!facilityIds.some((id) => scope.facilityIds.includes(id))) throw new ForbiddenError();
  }
}

export class ListCalendarUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; ownerUserId?: number; from: Date; to: Date }) {
    assertRange(input.from, input.to);
    const owner = assertOwnerRead(input.actor, input.scope, input.ownerUserId);
    const managerView = input.actor.roleName === "MANAGER" && owner !== input.actor.userId;
    const events = await this.deps.repository.listByOwner(owner, { from: input.from, to: input.to });
    const now = this.deps.now?.() ?? new Date();
    // Whose day this is, so "missed" follows their hours rather than a default
    // nobody chose (§15.5.5).
    const ownerWorkdayEnd = await this.deps.repository.findWorkdayEnd(owner);
    const rows: CalendarOccurrenceDto[] = [];
    for (const event of events) {
      const occurrences = effectiveOccurrences(event, input.from, input.to);
      let interactions = event.interactions;
      if (event.kind === "INTERACTION") {
        interactions = await this.deps.repository.ensureInteractionsForOccurrences(event.id, occurrences.map((item) => item.recurrenceKey));
      }
      for (const occurrence of occurrences) {
        const interaction = interactions.find((item) => item.recurrenceKey === occurrence.recurrenceKey);
        // A manager sees a rep's clinic visits only for clinics in their own
        // scope. An interaction with no clinic has no facility to test, and a
        // contact with a doctor is the rep's own record, so it is not shown in
        // a manager's view of somebody else's day rather than shown unchecked.
        if (event.kind === "INTERACTION" && (!interaction || (managerView && !input.scope.isGlobal
          && (interaction.facilityId === null || !input.scope.facilityIds.includes(interaction.facilityId))))) continue;
        if (interaction?.status === "CANCELLED") continue;
        // The **same rule** the interactions module uses (§15.7.7): a visit is
        // missed once the rep's working day is over, not when its own window
        // closes. This is the copy the agenda and the day card read, and it
        // disagreeing with the one the server enforces is what offered a
        // "Cheguei" the server then refused.
        const effectiveInteractionStatus = interaction?.status === "SCHEDULED"
          && missedAfter({ occurrenceEndsAt: occurrence.endsAt, timeZone: event.timeZone, workdayEnd: ownerWorkdayEnd }) <= now
          ? "NOT_COMPLETED"
          : interaction?.status;
        rows.push({ id: `${event.id}:${occurrence.recurrenceKey}`, calendarId: event.id, recurrenceKey: occurrence.recurrenceKey,
          ownerUserId: event.ownerUserId, kind: event.kind, title: managerView && event.kind === "PERSONAL_BLOCK" ? "Indisponível" : event.title,
          startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), timeZone: event.timeZone,
          durationMinutes: Math.round((occurrence.endsAt.getTime() - occurrence.startsAt.getTime()) / 60_000),
          recurrence: event.recurrence, recurrenceUntil: event.recurrenceUntil, recurrenceCount: event.recurrenceCount,
          // Where the *series* starts, not this occurrence. Editing a whole
          // series has to edit the series' own anchor: seeding the form from
          // the occurrence the rep happened to tap re-anchored the series to
          // that date on save, silently dropping every occurrence before it.
          anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime,
          version: event.version, calendarVersion: event.version, owner: event.owner, facility: event.facility,
          canMutate: !managerView && event.ownerUserId === input.actor.userId,
          ...(occurrence.override ? { overrideVersion: occurrence.override.version } : {}),
          ...(interaction ? { interaction: { id: interaction.id, facilityId: interaction.facilityId,
            person: interaction.person ?? null, modality: interaction.modality,
            status: effectiveInteractionStatus!, version: interaction.version,
            missReason: interaction.missReason ?? null,
            actualStartedAt: interaction.actualStartedAt?.toISOString() ?? null,
            actualEndedAt: interaction.actualEndedAt?.toISOString() ?? null } } : {}) });
        if (rows.length > MAX_RESULTS) throw new ValidationError([{ field: "range", message: `Calendar result exceeds ${MAX_RESULTS} occurrences` }]);
      }
    }
    return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  }
}

export class GetCalendarAvailabilityUseCase {
  private readonly list: ListCalendarUseCase;
  constructor(deps: Dependencies) { this.list = new ListCalendarUseCase(deps); }
  async execute(input: { actor: Actor; scope: ScopeContext; ownerUserId?: number; from: Date; to: Date }) {
    return (await this.list.execute(input)).map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
  }
}

export class UpdateCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: number; idempotencyKey: string; expectedVersion: number;
    changes: Partial<{ title: string; startsAt: string; timeZone: string; durationMinutes: number; recurrence: CalendarRecurrence; recurrenceUntil: string | null; recurrenceCount: number | null }> }) {
    const owner = (await loadOwned(this.deps.repository, input.id, input.actor)).ownerUserId;
    const commandKind = "UPDATE_SERIES";
    const fingerprint = commandFingerprint(commandKind, input.id, input.expectedVersion, input.changes);
    return this.deps.repository.runWithOwnerLock(owner, async (repository) => {
      const replay = replayResult(await repository.getCommandReceipt<CalendarEventRecord>(owner, input.idempotencyKey), commandKind, input.id, fingerprint);
      if (replay) return receiptEvent(replay);
      const current = await loadOwned(repository, input.id, input.actor);
      const changesRecurrenceShape = input.changes.startsAt !== undefined
        || input.changes.timeZone !== undefined
        || input.changes.durationMinutes !== undefined
        || input.changes.recurrence !== undefined
        || input.changes.recurrenceUntil !== undefined
        || input.changes.recurrenceCount !== undefined;
      if (current.kind === "INTERACTION" && current.interactions.length > 0 && changesRecurrenceShape) {
        const blocked = current.interactions.some((item) => item.status !== "SCHEDULED" || item.visitId
          || (item.linkedOrderCount ?? 0) > 0 || item.actualStartedAt || item.actualEndedAt
          || (item.lifecycleEventCount ?? 0) > 0);
        if (blocked) throw new ValidationError([{ field: "recurrence", message: "Recurrence shape can change only while every materialized interaction is untouched and scheduled" }]);
        if (current.overrides.some((item) => item.status === "ACTIVE")) {
          throw new ValidationError([{ field: "recurrence", message: "Recurrence shape cannot change while active occurrence overrides exist" }]);
        }
      }
      const nextData: EventData = { kind: current.kind, title: input.changes.title ?? current.title,
        startsAt: input.changes.startsAt ?? firstStartsAt(current).toISOString(), timeZone: input.changes.timeZone ?? current.timeZone,
        durationMinutes: input.changes.durationMinutes ?? current.durationMinutes, recurrence: input.changes.recurrence ?? current.recurrence,
        recurrenceUntil: input.changes.recurrenceUntil === null ? undefined : input.changes.recurrenceUntil ?? current.recurrenceUntil ?? undefined,
        recurrenceCount: input.changes.recurrenceCount === null ? undefined : input.changes.recurrenceCount ?? current.recurrenceCount ?? undefined };
      const values = eventValues(current.ownerUserId, nextData);
      const nextRule = conflictFrom(values, current.id, current.overrides).rule;
      const recurrenceKeyMap = current.kind === "INTERACTION" && current.interactions.length > 0 && changesRecurrenceShape
        ? current.interactions.map((interaction) => {
          const newRecurrenceKey = mapCalendarRecurrenceKey(ruleOf(current), nextRule, interaction.recurrenceKey);
          if (!newRecurrenceKey) {
            throw new ValidationError([{ field: "recurrence", message: `Cannot deterministically map materialized occurrence ${interaction.recurrenceKey}` }]);
          }
          return { oldRecurrenceKey: interaction.recurrenceKey, newRecurrenceKey };
        })
        : undefined;
      const invalid: string[] = [];
      for (const override of current.overrides) {
        if (calendarOccurrenceFromRecurrenceKey(nextRule, override.recurrenceKey)) continue;
        const original = calendarOccurrenceFromRecurrenceKey(ruleOf(current), override.recurrenceKey);
        const interaction = current.interactions.find((item) => item.recurrenceKey === override.recurrenceKey);
        if (original && original.startsAt > new Date() && (!interaction || interaction.status === "SCHEDULED")) invalid.push(override.recurrenceKey);
        else throw new ValidationError([{ field: "recurrence", message: `Update would orphan occurrence ${override.recurrenceKey}` }]);
      }
      const keptOverrides = current.overrides.filter((item) => !invalid.includes(item.recurrenceKey));
      const conflicts = findCalendarConflicts(conflictFrom(values, current.id, keptOverrides), await repository.listConflictEntries(current.ownerUserId, current.id, { from: values.firstStartsAt }), { from: values.firstStartsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      if (recurrenceKeyMap && !(await repository.replaceUntouchedInteractions({ calendarId: current.id, recurrenceKeyMap }))) {
        throw new ValidationError([{ field: "recurrence", message: "One or more materialized interactions are no longer untouched" }]);
      }
      if (invalid.length) await repository.deleteInvalidOverrides(current.id, invalid);
      const updated = await repository.update({ id: current.id, expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey, changes: values });
      if (!updated) throw new CalendarVersionConflictError(current.id, input.expectedVersion);
      return (await repository.saveCommandReceipt(owner, input.idempotencyKey, commandKind, updated.id, fingerprint, updated)).result;
    });
  }
}

function occurrenceCandidate(event: CalendarEventRecord, startsAt: Date, endsAt: Date, recurrenceKey: string): CalendarConflictEntry {
  const anchor = localAnchor(startsAt, event.timeZone);
  return { id: `${event.id}:${recurrenceKey}`, rule: { anchorLocalDate: anchor.date, anchorLocalTime: anchor.time,
    timeZone: event.timeZone, durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000), recurrence: "NONE" } };
}

async function interactionFor(repository: CalendarRepository, event: CalendarEventRecord, recurrenceKey: string): Promise<CalendarInteractionRecord | undefined> {
  if (event.kind !== "INTERACTION") return undefined;
  const interactions = await repository.ensureInteractionsForOccurrences(event.id, [recurrenceKey]);
  return interactions.find((item) => item.recurrenceKey === recurrenceKey);
}

export class UpdateCalendarOccurrenceUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: number; recurrenceKey: string; idempotencyKey: string; expectedVersion: number; startsAt: string; durationMinutes: number }) {
    const owner = (await loadOwned(this.deps.repository, input.id, input.actor)).ownerUserId;
    const commandKind = "UPDATE_OCCURRENCE";
    const resourceId = input.id;
    const fingerprint = commandFingerprint(commandKind, resourceId, input.expectedVersion, { startsAt: input.startsAt, durationMinutes: input.durationMinutes });
    return this.deps.repository.runWithOwnerLock(owner, async (repository) => {
      const replay = replayResult(await repository.getCommandReceipt<CalendarOverrideRecord>(owner, input.idempotencyKey), commandKind, resourceId, fingerprint);
      if (replay) return receiptOverride(replay);
      const event = await loadOwned(repository, input.id, input.actor);
      const original = calendarOccurrenceFromRecurrenceKey(ruleOf(event), input.recurrenceKey);
      if (!original) throw new ResourceNotFoundError("CalendarOccurrence", input.recurrenceKey);
      const interaction = await interactionFor(repository, event, input.recurrenceKey);
      if (event.kind === "INTERACTION" && interaction?.status !== "SCHEDULED") throw new ValidationError([{ field: "recurrenceKey", message: "Only scheduled interaction occurrences may be rescheduled" }]);
      const currentOverride = event.overrides.find((item) => item.recurrenceKey === input.recurrenceKey && item.status === "ACTIVE");
      const previousStartsAt = currentOverride?.startsAt ?? original.startsAt;
      const previousEndsAt = currentOverride?.endsAt ?? original.endsAt;
      const startsAt = new Date(input.startsAt); const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
      validateEventData({ kind: event.kind, title: event.title, startsAt: input.startsAt, timeZone: event.timeZone,
        durationMinutes: input.durationMinutes, recurrence: "NONE" });
      const siblings = entryOf(event, [input.recurrenceKey]);
      const others = await repository.listConflictEntries(event.ownerUserId, event.id, { from: startsAt, to: endsAt });
      const conflicts = findCalendarConflicts(occurrenceCandidate(event, startsAt, endsAt, input.recurrenceKey), [siblings, ...others], { from: startsAt, to: endsAt });
      if (conflicts.length) throw new CalendarConflictError(conflicts.slice(0, 10));
      const result = await repository.upsertOverride({ calendarId: event.id, recurrenceKey: input.recurrenceKey, startsAt, endsAt,
        status: "ACTIVE", actorUserId: input.actor.userId, previousStartsAt, previousEndsAt,
        expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey });
      if (!result) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
      return (await repository.saveCommandReceipt(owner, input.idempotencyKey, commandKind, resourceId, fingerprint, result)).result;
    });
  }
}

function reason(value: string) { const trimmed = value.trim(); if (!trimmed) throw new ValidationError([{ field: "reason", message: "Cancellation reason is required" }]); return trimmed; }

export class CancelCalendarOccurrenceUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: number; recurrenceKey: string; idempotencyKey: string; expectedVersion: number; reason: string }) {
    const owner = (await loadOwned(this.deps.repository, input.id, input.actor)).ownerUserId;
    const commandKind = "CANCEL_OCCURRENCE";
    const resourceId = input.id;
    const fingerprint = commandFingerprint(commandKind, resourceId, input.expectedVersion, { reason: input.reason.trim(), recurrenceKey: input.recurrenceKey });
    return this.deps.repository.runWithOwnerLock(owner, async (repository) => {
      const replay = replayResult(await repository.getCommandReceipt<CalendarOverrideRecord>(owner, input.idempotencyKey), commandKind, resourceId, fingerprint);
      if (replay) return receiptOverride(replay);
      const event = await loadOwned(repository, input.id, input.actor);
      const original = calendarOccurrenceFromRecurrenceKey(ruleOf(event), input.recurrenceKey);
      if (!original) throw new ResourceNotFoundError("CalendarOccurrence", input.recurrenceKey);
      const interaction = await interactionFor(repository, event, input.recurrenceKey);
      if (event.kind === "INTERACTION" && interaction?.status !== "SCHEDULED") throw new ValidationError([{ field: "recurrenceKey", message: "Only scheduled interaction occurrences may be cancelled" }]);
      const cancellationReason = reason(input.reason);
      const result = await repository.upsertOverride({ calendarId: event.id, recurrenceKey: input.recurrenceKey, startsAt: original.startsAt, endsAt: original.endsAt,
        status: "CANCELLED", reason: cancellationReason, actorUserId: input.actor.userId,
        expectedVersion: input.expectedVersion, commandKey: input.idempotencyKey });
      if (!result) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
      if (event.kind === "INTERACTION") {
        const cancelledCount = await repository.cancelInteractionOccurrences({ calendarId: event.id,
          recurrenceKeys: [input.recurrenceKey], actorUserId: input.actor.userId, reason: cancellationReason });
        if (cancelledCount !== 1) throw new ValidationError([{ field: "recurrenceKey", message: "Interaction occurrence is no longer scheduled" }]);
      }
      return (await repository.saveCommandReceipt(owner, input.idempotencyKey, commandKind, resourceId, fingerprint, result)).result;
    });
  }
}

export class CancelCalendarEventUseCase {
  constructor(private readonly deps: Dependencies) {}
  async execute(input: { actor: Actor; scope: ScopeContext; id: number; idempotencyKey: string; expectedVersion: number; reason: string }) {
    const owner = (await loadOwned(this.deps.repository, input.id, input.actor)).ownerUserId;
    const commandKind = "CANCEL_SERIES";
    const fingerprint = commandFingerprint(commandKind, input.id, input.expectedVersion, { reason: input.reason.trim() });
    return this.deps.repository.runWithOwnerLock(owner, async (repository) => {
      const replay = replayResult(await repository.getCommandReceipt<{ id: number; cancelled: true }>(owner, input.idempotencyKey), commandKind, input.id, fingerprint);
      if (replay) return replay;
      const event = await loadOwned(repository, input.id, input.actor);
      if (event.kind === "INTERACTION" && event.interactions.some((item) => item.status !== "SCHEDULED")) throw new ValidationError([{ field: "id", message: "Only scheduled interaction series may be cancelled" }]);
      const cancellationReason = reason(input.reason);
      if (event.kind === "INTERACTION") {
        const cancelledCount = await repository.cancelInteractionOccurrences({ calendarId: event.id,
          actorUserId: input.actor.userId, reason: cancellationReason });
        if (cancelledCount !== event.interactions.length) throw new ValidationError([{ field: "id", message: "One or more interactions are no longer scheduled" }]);
      }
      const cancelled = await repository.cancel({ id: event.id, expectedVersion: input.expectedVersion,
        actorUserId: input.actor.userId, reason: cancellationReason, commandKey: input.idempotencyKey });
      if (!cancelled) throw new CalendarVersionConflictError(event.id, input.expectedVersion);
      const result = { id: event.id, cancelled: true as const };
      return (await repository.saveCommandReceipt(owner, input.idempotencyKey, commandKind, event.id, fingerprint, result)).result;
    });
  }
}
