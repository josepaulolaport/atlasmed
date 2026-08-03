import { describe, expect, it } from "bun:test";
import { createGlobalScopeContext, createEmptyScopeContext, type ScopeContext } from "@atlasmed/access";
import { CalendarConflictError, CalendarVersionConflictError, ForbiddenError, ValidationError } from "../../../../shared/errors";
import type {
  CalendarEventRecord,
  CalendarRepository,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  UpsertCalendarOverrideInput,
} from "../interfaces/calendar.repository.interface";
import {
  CancelCalendarEventUseCase,
  CancelCalendarOccurrenceUseCase,
  CreateCalendarEventUseCase,
  GetCalendarAvailabilityUseCase,
  ListCalendarUseCase,
  UpdateCalendarEventUseCase,
  UpdateCalendarOccurrenceUseCase,
} from "./calendar.use-cases";

const baseEvent = (overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord => ({
  id: "calendar-1",
  ownerUserId: "rep-1",
  kind: "PERSONAL_BLOCK",
  title: "Consulta médica",
  anchorLocalDate: "2026-08-03",
  anchorLocalTime: "09:00",
  timeZone: "UTC",
  durationMinutes: 60,
  firstStartsAt: new Date("2026-08-03T09:00:00.000Z"),
  firstEndsAt: new Date("2026-08-03T10:00:00.000Z"),
  recurrence: "NONE",
  recurrenceUntil: null,
  recurrenceCount: null,
  status: "ACTIVE",
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  version: 1,
  overrides: [],
  interactions: [],
  ...overrides,
});

class FakeCalendarRepository implements CalendarRepository {
  events: CalendarEventRecord[] = [];
  created?: CreateCalendarEventInput;
  updated?: UpdateCalendarEventInput;
  override?: UpsertCalendarOverrideInput;
  deleted?: { id: string; expectedVersion: number; actorUserId?: string; reason?: string; commandKey?: string };
  versionFailure = false;
  ensuredKeys: string[] = [];
  createCalls = 0;
  cancelCalls = 0;
  receipts = new Map<string, unknown>();
  private locked = false;

  async runWithOwnerLock<T>(_ownerUserId: string, work: (repository: CalendarRepository) => Promise<T>): Promise<T> {
    this.locked = true;
    try { return await work(this); } finally { this.locked = false; }
  }
  async listByOwner(ownerUserId: string, _range?: { from: Date; to: Date }) { return this.events.filter((event) => event.ownerUserId === ownerUserId && event.status !== "CANCELLED"); }
  async findById(id: string) { return this.events.find((event) => event.id === id) ?? null; }
  async ensureInteractionsForOccurrences(calendarId: string, recurrenceKeys: string[]) {
    this.ensuredKeys.push(...recurrenceKeys);
    const event = await this.findById(calendarId);
    if (!event || event.kind !== "INTERACTION") return event?.interactions ?? [];
    const seed = event.interactions[0];
    if (!seed) return [];
    for (const recurrenceKey of recurrenceKeys) {
      if (!event.interactions.some((item) => item.recurrenceKey === recurrenceKey)) {
        event.interactions.push({ ...seed, id: `interaction-${event.interactions.length + 1}`, recurrenceKey, status: "SCHEDULED", version: 1 });
      }
    }
    return event.interactions.filter((item) => recurrenceKeys.includes(item.recurrenceKey));
  }
  async getCommandReceipt<T>(ownerUserId: string, commandKey: string) { return this.receipts.get(`${ownerUserId}:${commandKey}`) as T | undefined; }
  async saveCommandReceipt<T>(ownerUserId: string, commandKey: string, _kind: string, resourceId: string | null, result: T) {
    this.receipts.set(`${ownerUserId}:${commandKey}`, result);
    return result;
  }
  async listConflictEntries(ownerUserId: string, excludeCalendarId?: string) {
    return this.events.filter((event) => event.ownerUserId === ownerUserId && event.id !== excludeCalendarId).map((event) => ({
      id: event.id,
      rule: {
        anchorLocalDate: event.anchorLocalDate,
        anchorLocalTime: event.anchorLocalTime,
        timeZone: event.timeZone,
        durationMinutes: event.durationMinutes,
        recurrence: event.recurrence,
        ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}),
        ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}),
      },
    }));
  }
  async create(input: CreateCalendarEventInput) {
    this.createCalls += 1;
    this.created = input;
    const event = baseEvent({
      ...input.event,
      id: "created-calendar",
      version: 1,
      overrides: [],
      interactions: input.interaction ? [{
        id: "interaction-1",
        recurrenceKey: input.interaction.recurrenceKey,
        facilityId: input.interaction.facilityId,
        modality: input.interaction.modality,
        status: "SCHEDULED",
        version: 1,
      }] : [],
    });
    this.events.push(event);
    return event;
  }
  async update(input: UpdateCalendarEventInput) {
    this.updated = input;
    if (this.versionFailure) return null;
    const current = await this.findById(input.id);
    return current ? baseEvent({ ...current, ...input.changes, version: current.version + 1 }) : null;
  }
  async upsertOverride(input: UpsertCalendarOverrideInput) {
    this.override = input;
    if (this.versionFailure) return null;
    return { id: "override-1", calendarId: input.calendarId, recurrenceKey: input.recurrenceKey,
      startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, reason: input.reason ?? null,
      version: (input.expectedVersion ?? 0) + 1 };
  }
  async cancel(input: { id: string; expectedVersion: number; actorUserId: string; reason: string; commandKey: string }) {
    if (!this.locked) throw new Error("owner lock required");
    this.cancelCalls += 1;
    this.deleted = input;
    if (this.versionFailure) return null;
    const event = await this.findById(input.id);
    if (!event) return null;
    event.status = "CANCELLED";
    event.cancelledAt = new Date("2026-08-03T12:00:00Z");
    event.cancelledByUserId = input.actorUserId;
    event.cancellationReason = input.reason;
    event.version += 1;
    return event;
  }
  async deleteInvalidOverrides() { return true; }
}

const repScope = createGlobalScopeContext() as ScopeContext;
const managerScope = {
  ...createEmptyScopeContext(),
  managedUserIds: ["rep-1"],
  facilityIds: ["facility-1"],
  isOperationallyActive: true,
} as ScopeContext;

const createInteraction = {
  kind: "INTERACTION" as const,
  title: "Visita clínica",
  facilityId: "facility-1",
  modality: "IN_PERSON" as const,
  startsAt: "2026-08-03T09:00:00-03:00",
  timeZone: "America/Sao_Paulo",
  durationMinutes: 60,
  recurrence: "WEEKLY" as const,
  recurrenceCount: 2,
};

describe("Calendar application use cases", () => {
  it("creates an interaction as the actor and persists calendar plus interaction under the owner lock", async () => {
    const repository = new FakeCalendarRepository();
    const result = await new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      idempotencyKey: "cmd-create-1", data: createInteraction,
    });

    expect(result.ownerUserId).toBe("rep-1");
    expect(repository.created?.commandKey).toBe("cmd-create-1");
    expect(repository.created?.interaction).toMatchObject({ facilityId: "facility-1", modality: "IN_PERSON" });
    expect(repository.created?.event).toMatchObject({ anchorLocalDate: "2026-08-03", anchorLocalTime: "09:00" });
  });

  it("rejects interaction creation outside facility scope", async () => {
    const repository = new FakeCalendarRepository();
    await expect(new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" },
      scope: { ...managerScope, managedUserIds: [] } as ScopeContext,
      idempotencyKey: "cmd", data: { ...createInteraction, facilityId: "facility-out" },
    })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates explicit first occurrence instants even when historical rows may map null", async () => {
    const repository = new FakeCalendarRepository();
    await new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      idempotencyKey: "first-instants", data: createInteraction,
    });
    expect(repository.created?.event.firstStartsAt).toEqual(new Date("2026-08-03T12:00:00.000Z"));
    expect(repository.created?.event.firstEndsAt).toEqual(new Date("2026-08-03T13:00:00.000Z"));
  });

  it("returns typed conflict details and does not create overlapping events", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ firstStartsAt: new Date("2026-08-03T12:00:00Z"), firstEndsAt: new Date("2026-08-03T13:00:00Z"),
      anchorLocalDate: "2026-08-03", anchorLocalTime: "12:00" })];
    await expect(new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      idempotencyKey: "cmd", data: { ...createInteraction, recurrence: "NONE", recurrenceCount: undefined },
    })).rejects.toBeInstanceOf(CalendarConflictError);
    expect(repository.created).toBeUndefined();
  });

  it("expands recurrence, applies overrides, sorts chronologically, and redacts manager blocks", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ recurrence: "DAILY", recurrenceCount: 2, overrides: [{
      id: "override-1", calendarId: "calendar-1", recurrenceKey: "2026-08-03T09:00[UTC]",
      startsAt: new Date("2026-08-03T11:00:00Z"), endsAt: new Date("2026-08-03T12:00:00Z"),
      status: "ACTIVE", reason: null, version: 2,
    }] })];

    const result = await new ListCalendarUseCase({ repository }).execute({
      actor: { userId: "manager-1", roleName: "MANAGER" }, scope: managerScope, ownerUserId: "rep-1",
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-06T00:00:00Z"),
    });

    expect(result.map((row) => row.startsAt)).toEqual([
      "2026-08-03T11:00:00.000Z", "2026-08-04T09:00:00.000Z",
    ]);
    expect(result.every((row) => row.title === "Indisponível")).toBe(true);
    expect(result[0]?.id).toBe("calendar-1:2026-08-03T09:00[UTC]");
  });

  it("filters manager interaction rows outside facility scope and rejects unmanaged owners", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", interactions: [{ id: "i", recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: "facility-out", modality: "REMOTE", status: "SCHEDULED", version: 1 }] })];
    const useCase = new ListCalendarUseCase({ repository });
    expect(await useCase.execute({ actor: { userId: "manager-1", roleName: "MANAGER" }, scope: managerScope,
      ownerUserId: "rep-1", from: new Date("2026-08-03"), to: new Date("2026-08-04") })).toEqual([]);
    await expect(useCase.execute({ actor: { userId: "manager-1", roleName: "MANAGER" }, scope: managerScope,
      ownerUserId: "rep-2", from: new Date("2026-08-03"), to: new Date("2026-08-04") })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns occupied active intervals without work-hour restrictions", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ anchorLocalTime: "02:00", firstStartsAt: new Date("2026-08-03T02:00Z"), firstEndsAt: new Date("2026-08-03T03:00Z") })];
    const result = await new GetCalendarAvailabilityUseCase({ repository }).execute({ actor: { userId: "rep-1", roleName: "REP" },
      scope: repScope, from: new Date("2026-08-03"), to: new Date("2026-08-04") });
    expect(result).toEqual([{ startsAt: "2026-08-03T02:00:00.000Z", endsAt: "2026-08-03T03:00:00.000Z" }]);
  });

  it("enforces owner and optimistic version for series updates", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()]; repository.versionFailure = true;
    await expect(new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: "other", roleName: "REP" }, scope: repScope,
      id: "calendar-1", idempotencyKey: "cmd", expectedVersion: 1, changes: { title: "Novo" } })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      id: "calendar-1", idempotencyKey: "cmd", expectedVersion: 1, changes: { title: "Novo" } })).rejects.toBeInstanceOf(CalendarVersionConflictError);
  });

  it("reschedules a scheduled interaction occurrence and rejects non-scheduled interaction cancellation", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", interactions: [{ id: "i", recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: "facility-1", modality: "REMOTE", status: "SCHEDULED", version: 1 }] })];
    await new UpdateCalendarOccurrenceUseCase({ repository }).execute({ actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      id: "calendar-1", recurrenceKey: "2026-08-03T09:00[UTC]", idempotencyKey: "cmd", expectedVersion: 0,
      startsAt: "2026-08-03T12:00:00Z", durationMinutes: 30 });
    expect(repository.override).toMatchObject({ status: "ACTIVE", expectedVersion: 0 });

    repository.events[0] = baseEvent({ kind: "INTERACTION", interactions: [{ id: "i", recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: "facility-1", modality: "REMOTE", status: "COMPLETED", version: 2 }] });
    await expect(new CancelCalendarOccurrenceUseCase({ repository }).execute({ actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      id: "calendar-1", recurrenceKey: "2026-08-03T09:00[UTC]", idempotencyKey: "cmd-cancel", expectedVersion: 0, reason: " Cliente pediu " }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects occurrence rescheduling that overlaps an effective sibling in the same series", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ recurrence: "DAILY", recurrenceCount: 2 })];

    await expect(new UpdateCalendarOccurrenceUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope, id: "calendar-1",
      recurrenceKey: "2026-08-04T09:00[UTC]", idempotencyKey: "overlap-sibling", expectedVersion: 0,
      startsAt: "2026-08-03T09:30:00Z", durationMinutes: 30,
    })).rejects.toBeInstanceOf(CalendarConflictError);
  });

  it("materializes one independent interaction for every listed recurring occurrence", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({
      kind: "INTERACTION",
      recurrence: "DAILY",
      recurrenceCount: 2,
      interactions: [{ id: "interaction-1", recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: "facility-1", modality: "REMOTE", status: "SCHEDULED", version: 1 }],
    })];

    const result = await new ListCalendarUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope,
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-05T00:00:00Z"),
    });

    expect(repository.ensuredKeys).toEqual([
      "2026-08-03T09:00[UTC]",
      "2026-08-04T09:00[UTC]",
    ]);
    expect(result.map((item) => item.interaction?.id)).toEqual(["interaction-1", "interaction-2"]);
  });

  it("does not reuse another occurrence interaction state during cancellation", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({
      kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 2,
      interactions: [{ id: "interaction-1", recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: "facility-1", modality: "REMOTE", status: "COMPLETED", version: 2 }],
    })];

    await new CancelCalendarOccurrenceUseCase({ repository }).execute({
      actor: { userId: "rep-1", roleName: "REP" }, scope: repScope, id: "calendar-1",
      recurrenceKey: "2026-08-04T09:00[UTC]", idempotencyKey: "cancel-second", expectedVersion: 0,
      reason: "Cliente pediu",
    });

    expect(repository.ensuredKeys).toContain("2026-08-04T09:00[UTC]");
    expect(repository.override?.recurrenceKey).toBe("2026-08-04T09:00[UTC]");
  });

  it("replays a create command without executing the business write twice", async () => {
    const repository = new FakeCalendarRepository();
    const useCase = new CreateCalendarEventUseCase({ repository });
    const input = { actor: { userId: "rep-1", roleName: "REP" as const }, scope: repScope,
      idempotencyKey: "same-create", data: createInteraction };

    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(second).toEqual(first);
    expect(repository.createCalls).toBe(1);
  });

  it("soft-cancels and preserves the trimmed reason while replaying retries", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()];
    const useCase = new CancelCalendarEventUseCase({ repository });
    const input = { actor: { userId: "rep-1", roleName: "REP" as const }, scope: repScope, id: "calendar-1",
      idempotencyKey: "same-cancel", expectedVersion: 1, reason: "  compromisso cancelado " };

    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(second).toEqual(first);
    expect(repository.cancelCalls).toBe(1);
    expect(repository.events[0]).toMatchObject({ status: "CANCELLED", cancellationReason: "compromisso cancelado" });
  });

  it("requires a trimmed cancellation reason and soft-cancels an owned active series with expectedVersion", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()];
    const useCase = new CancelCalendarEventUseCase({ repository });
    await expect(useCase.execute({ actor: { userId: "rep-1", roleName: "REP" }, scope: repScope, id: "calendar-1",
      idempotencyKey: "cmd", expectedVersion: 1, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    await useCase.execute({ actor: { userId: "rep-1", roleName: "REP" }, scope: repScope, id: "calendar-1",
      idempotencyKey: "cmd", expectedVersion: 1, reason: "  compromisso cancelado " });
    expect(repository.deleted).toEqual({ id: "calendar-1", expectedVersion: 1, actorUserId: "rep-1", reason: "compromisso cancelado", commandKey: "cmd" });
  });
});
