import { describe, expect, it } from "bun:test";
import { createGlobalScopeContext, createEmptyScopeContext, type ScopeContext } from "@atlasmed/access";
import { CalendarConflictError, CalendarVersionConflictError, ForbiddenError, ValidationError } from "../../../../shared/errors";
import { CalendarIdempotencyConflictError } from "./calendar.use-cases";
import type {
  CalendarCommandReceipt,
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
  id: 1,
  ownerUserId: 1,
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
  owner: { id: 1, name: "Ana Silva" },
  facility: null,
  overrides: [],
  interactions: [],
  ...overrides,
});

class FakeCalendarRepository implements CalendarRepository {
  events: CalendarEventRecord[] = [];
  created?: CreateCalendarEventInput;
  updated?: UpdateCalendarEventInput;
  override?: UpsertCalendarOverrideInput;
  deleted?: { id: number; expectedVersion: number; actorUserId?: number; reason?: string; commandKey?: string };
  versionFailure = false;
  ensuredKeys: string[] = [];
  createCalls = 0;
  cancelCalls = 0;
  cancelledInteractions: Array<{ recurrenceKey: string; actorUserId: number; reason: string }> = [];
  receipts = new Map<string, CalendarCommandReceipt<unknown>>();
  replacedInteractions?: Array<{ id: number; recurrenceKey: string }>;
  private locked = false;

  async runWithOwnerLock<T>(_ownerUserId: number, work: (repository: CalendarRepository) => Promise<T>): Promise<T> {
    this.locked = true;
    try { return await work(this); } finally { this.locked = false; }
  }
  async listByOwner(ownerUserId: number, _range?: { from: Date; to: Date }) { return this.events.filter((event) => event.ownerUserId === ownerUserId && event.status !== "CANCELLED"); }
  async findById(id: number) { return this.events.find((event) => event.id === id) ?? null; }
  async ensureInteractionsForOccurrences(calendarId: number, recurrenceKeys: string[]) {
    this.ensuredKeys.push(...recurrenceKeys);
    const event = await this.findById(calendarId);
    if (!event || event.kind !== "INTERACTION") return event?.interactions ?? [];
    const seed = event.interactions[0];
    if (!seed) return [];
    for (const recurrenceKey of recurrenceKeys) {
      if (!event.interactions.some((item) => item.recurrenceKey === recurrenceKey)) {
        event.interactions.push({ ...seed, id: event.interactions.length + 10, recurrenceKey, status: "SCHEDULED", version: 1 });
      }
    }
    return event.interactions.filter((item) => recurrenceKeys.includes(item.recurrenceKey));
  }
  async cancelInteractionOccurrences(input: { calendarId: number; recurrenceKeys?: string[]; actorUserId: number; reason: string }) {
    const event = await this.findById(input.calendarId);
    if (!event) return 0;
    const targets = event.interactions.filter((item) => !input.recurrenceKeys || input.recurrenceKeys.includes(item.recurrenceKey));
    for (const item of targets) {
      if (item.status !== "SCHEDULED") throw new ValidationError([{ field: "recurrenceKey", message: "Only scheduled interaction occurrences may be cancelled" }]);
      item.status = "CANCELLED";
      item.version += 1;
      this.cancelledInteractions.push({ recurrenceKey: item.recurrenceKey, actorUserId: input.actorUserId, reason: input.reason });
    }
    return targets.length;
  }
  async getCommandReceipt<T>(ownerUserId: number, commandKey: string) {
    return this.receipts.get(`${ownerUserId}:${commandKey}`) as CalendarCommandReceipt<T> | undefined;
  }
  async saveCommandReceipt<T>(ownerUserId: number, commandKey: string, commandKind: string, resourceId: number | null, requestFingerprint: string, result: T) {
    const receipt = { commandKind, resourceId, requestFingerprint, result };
    this.receipts.set(`${ownerUserId}:${commandKey}`, receipt);
    return receipt;
  }
  async listConflictEntries(ownerUserId: number, excludeCalendarId?: number) {
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
      id: 99,
      version: 1,
      owner: { id: input.event.ownerUserId, name: "Ana Silva" },
      facility: input.interaction ? { id: input.interaction.facilityId, name: "Clínica Central" } : null,
      overrides: [],
      interactions: input.interaction ? [{
        id: 10,
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
    return { id: 20, calendarId: input.calendarId, recurrenceKey: input.recurrenceKey,
      startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, reason: input.reason ?? null,
      version: (input.expectedVersion ?? 0) + 1 };
  }
  async replaceUntouchedInteractions(input: { calendarId: number; recurrenceKeyMap: Array<{ oldRecurrenceKey: string; newRecurrenceKey: string }> }) {
    const event = await this.findById(input.calendarId);
    if (!event) return false;
    const mapped = new Map(input.recurrenceKeyMap.map((item) => [item.oldRecurrenceKey, item.newRecurrenceKey]));
    if (new Set(input.recurrenceKeyMap.map((item) => item.newRecurrenceKey)).size !== input.recurrenceKeyMap.length
      || event.interactions.some((item) => !mapped.has(item.recurrenceKey))) return false;
    this.replacedInteractions = event.interactions.map((item) => ({ id: item.id, recurrenceKey: mapped.get(item.recurrenceKey)! }));
    event.interactions = event.interactions.map((item) => ({ ...item, recurrenceKey: mapped.get(item.recurrenceKey)! }));
    return true;
  }
  async cancel(input: { id: number; expectedVersion: number; actorUserId: number; reason: string; commandKey: string }) {
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
  managedUserIds: [1],
  facilityIds: [1],
  isOperationallyActive: true,
} as ScopeContext;

const createInteraction = {
  kind: "INTERACTION" as const,
  title: "Visita clínica",
  facilityId: 1,
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
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
      idempotencyKey: "cmd-create-1", data: createInteraction,
    });

    expect(result.ownerUserId).toBe(1);
    expect(repository.created?.commandKey).toBe("cmd-create-1");
    expect(repository.created?.interaction).toMatchObject({ facilityId: 1, modality: "IN_PERSON" });
    expect(repository.created?.event).toMatchObject({ anchorLocalDate: "2026-08-03", anchorLocalTime: "09:00" });
  });

  it("rejects interaction creation outside facility scope", async () => {
    const repository = new FakeCalendarRepository();
    await expect(new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: 1, roleName: "REP" },
      scope: { ...managerScope, managedUserIds: [] } as ScopeContext,
      idempotencyKey: "cmd", data: { ...createInteraction, facilityId: 99 },
    })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates explicit first occurrence instants even when historical rows may map null", async () => {
    const repository = new FakeCalendarRepository();
    await new CreateCalendarEventUseCase({ repository }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
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
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
      idempotencyKey: "cmd", data: { ...createInteraction, recurrence: "NONE", recurrenceCount: undefined },
    })).rejects.toBeInstanceOf(CalendarConflictError);
    expect(repository.created).toBeUndefined();
  });

  it("expands recurrence, applies overrides, sorts chronologically, and redacts manager blocks", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ recurrence: "DAILY", recurrenceCount: 2, overrides: [{
      id: 20, calendarId: 1, recurrenceKey: "2026-08-03T09:00[UTC]",
      startsAt: new Date("2026-08-03T11:00:00Z"), endsAt: new Date("2026-08-03T12:00:00Z"),
      status: "ACTIVE", reason: null, version: 2,
    }] })];

    const result = await new ListCalendarUseCase({ repository }).execute({
      actor: { userId: 2, roleName: "MANAGER" }, scope: managerScope, ownerUserId: 1,
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-06T00:00:00Z"),
    });

    expect(result.map((row) => row.startsAt)).toEqual([
      "2026-08-03T11:00:00.000Z", "2026-08-04T09:00:00.000Z",
    ]);
    expect(result.every((row) => row.title === "Indisponível")).toBe(true);
    expect(result[0]?.id).toBe("1:2026-08-03T09:00[UTC]");
  });

  it("filters manager interaction rows outside facility scope and rejects unmanaged owners", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", facility: { id: 99, name: "Fora do escopo" }, interactions: [{ id: 1, recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: 99, modality: "REMOTE", status: "SCHEDULED", version: 1 }] })];
    const useCase = new ListCalendarUseCase({ repository });
    expect(await useCase.execute({ actor: { userId: 2, roleName: "MANAGER" }, scope: managerScope,
      ownerUserId: 1, from: new Date("2026-08-03"), to: new Date("2026-08-04") })).toEqual([]);
    await expect(useCase.execute({ actor: { userId: 2, roleName: "MANAGER" }, scope: managerScope,
      ownerUserId: 3, from: new Date("2026-08-03"), to: new Date("2026-08-04") })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns the mobile calendar contract with recurrence, identities, versions, and effective missed state", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({
      kind: "INTERACTION", recurrence: "WEEKLY", recurrenceCount: 2,
      owner: { id: 1, name: "Ana Silva" }, facility: { id: 1, name: "Clínica Central" },
      interactions: [{ id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 7 }],
      overrides: [{ id: 20, calendarId: 1, recurrenceKey: "2026-08-03T09:00[UTC]",
        startsAt: new Date("2026-08-03T11:00:00Z"), endsAt: new Date("2026-08-03T12:00:00Z"), status: "ACTIVE", reason: null, version: 2 }],
    })];

    const [result] = await new ListCalendarUseCase({ repository, now: () => new Date("2026-08-03T12:00:00.001Z") }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-04T00:00:00Z"),
    });

    expect(result).toEqual(expect.objectContaining({
      calendarId: 1, recurrenceKey: "2026-08-03T09:00[UTC]", recurrence: "WEEKLY", recurrenceCount: 2,
      recurrenceUntil: null, calendarVersion: 1, version: 1, overrideVersion: 2, canMutate: true,
      owner: { id: 1, name: "Ana Silva" }, facility: { id: 1, name: "Clínica Central" },
      interaction: expect.objectContaining({ id: 10, status: "NOT_COMPLETED", version: 7 }),
    }));
    expect(repository.events[0]?.interactions[0]?.status).toBe("SCHEDULED");
  });

  it("derives NOT_COMPLETED when an interaction ends exactly at now", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", interactions: [{
      id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1,
    }] })];
    const [result] = await new ListCalendarUseCase({ repository, now: () => new Date("2026-08-03T10:00:00.000Z") }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-04T00:00:00Z"),
    });
    expect(result?.interaction?.status).toBe("NOT_COMPLETED");
  });

  it("returns occupied active intervals without work-hour restrictions", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ anchorLocalTime: "02:00", firstStartsAt: new Date("2026-08-03T02:00Z"), firstEndsAt: new Date("2026-08-03T03:00Z") })];
    const result = await new GetCalendarAvailabilityUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" },
      scope: repScope, from: new Date("2026-08-03"), to: new Date("2026-08-04") });
    expect(result).toEqual([{ startsAt: "2026-08-03T02:00:00.000Z", endsAt: "2026-08-03T03:00:00.000Z" }]);
  });

  it("enforces owner and optimistic version for series updates", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()]; repository.versionFailure = true;
    await expect(new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: 99, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "cmd", expectedVersion: 1, changes: { title: "Novo" } })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "cmd", expectedVersion: 1, changes: { title: "Novo" } })).rejects.toBeInstanceOf(CalendarVersionConflictError);
  });

  it("reschedules a scheduled interaction occurrence and rejects non-scheduled interaction cancellation", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", interactions: [{ id: 1, recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1 }] })];
    await new UpdateCalendarOccurrenceUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, recurrenceKey: "2026-08-03T09:00[UTC]", idempotencyKey: "cmd", expectedVersion: 0,
      startsAt: "2026-08-03T12:00:00Z", durationMinutes: 30 });
    expect(repository.override).toMatchObject({ status: "ACTIVE", expectedVersion: 0 });

    repository.events[0] = baseEvent({ kind: "INTERACTION", interactions: [{ id: 1, recurrenceKey: "2026-08-03T09:00[UTC]",
      facilityId: 1, modality: "REMOTE", status: "COMPLETED", version: 2 }] });
    await expect(new CancelCalendarOccurrenceUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, recurrenceKey: "2026-08-03T09:00[UTC]", idempotencyKey: "cmd-cancel", expectedVersion: 0, reason: " Cliente pediu " }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("cancels a scheduled interaction occurrence and its lifecycle row with user metadata", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", facility: { id: 1, name: "Clínica Central" }, interactions: [{
      id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1,
    }] })];

    await new CancelCalendarOccurrenceUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, recurrenceKey: "2026-08-03T09:00[UTC]", idempotencyKey: "cancel-occ", expectedVersion: 0, reason: " Cliente pediu " });

    expect(repository.cancelledInteractions).toEqual([{ recurrenceKey: "2026-08-03T09:00[UTC]", actorUserId: 1, reason: "Cliente pediu" }]);
    expect(repository.events[0]?.interactions[0]).toMatchObject({ status: "CANCELLED", version: 2 });
  });

  it("rejects occurrence rescheduling that overlaps an effective sibling in the same series", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ recurrence: "DAILY", recurrenceCount: 2 })];

    await expect(new UpdateCalendarOccurrenceUseCase({ repository }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope, id: 1,
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
      interactions: [{ id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1 }],
    })];

    const result = await new ListCalendarUseCase({ repository }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope,
      from: new Date("2026-08-03T00:00:00Z"), to: new Date("2026-08-05T00:00:00Z"),
    });

    expect(repository.ensuredKeys).toEqual([
      "2026-08-03T09:00[UTC]",
      "2026-08-04T09:00[UTC]",
    ]);
    expect(result.map((item) => item.interaction?.id)).toEqual([10, 11]);
  });

  it("does not reuse another occurrence interaction state during cancellation", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({
      kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 2,
      interactions: [{ id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "COMPLETED", version: 2 }],
    })];

    await new CancelCalendarOccurrenceUseCase({ repository }).execute({
      actor: { userId: 1, roleName: "REP" }, scope: repScope, id: 1,
      recurrenceKey: "2026-08-04T09:00[UTC]", idempotencyKey: "cancel-second", expectedVersion: 0,
      reason: "Cliente pediu",
    });

    expect(repository.ensuredKeys).toContain("2026-08-04T09:00[UTC]");
    expect(repository.override?.recurrenceKey).toBe("2026-08-04T09:00[UTC]");
  });

  it("rekeys untouched scheduled interactions when the materialized series shape changes", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 2,
      facility: { id: 1, name: "Clínica Central" }, interactions: [
        { id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", visitId: null, linkedOrderCount: 0, version: 1 },
        { id: 11, recurrenceKey: "2026-08-04T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", visitId: null, linkedOrderCount: 0, version: 1 },
      ] })];

    await new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "shape", expectedVersion: 1,
      changes: { startsAt: "2026-08-03T10:00:00Z", timeZone: "UTC", durationMinutes: 30 } });

    expect(repository.replacedInteractions).toEqual([
      { id: 10, recurrenceKey: "2026-08-03T10:00[UTC]" },
      { id: 11, recurrenceKey: "2026-08-04T10:00[UTC]" },
    ]);
  });

  it("maps a later-only materialized interaction to the corresponding later occurrence", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 3,
      facility: { id: 1, name: "Clínica Central" }, interactions: [
        { id: 12, recurrenceKey: "2026-08-05T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", visitId: null, linkedOrderCount: 0, version: 1 },
      ] })];

    await new UpdateCalendarEventUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "later-only-shape", expectedVersion: 1,
      changes: { startsAt: "2026-08-03T10:00:00Z", timeZone: "UTC", durationMinutes: 30 } });

    expect(repository.replacedInteractions).toEqual([
      { id: 12, recurrenceKey: "2026-08-05T10:00[UTC]" },
    ]);
  });

  it("rejects series shape edits when a materialized interaction has append-only lifecycle history but allows title-only edits", async () => {
    const repository = new FakeCalendarRepository();
    const useCase = new UpdateCalendarEventUseCase({ repository });
    repository.events = [baseEvent({ kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 1,
      facility: { id: 1, name: "Clínica Central" }, interactions: [{
        id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED",
        visitId: null, linkedOrderCount: 0, lifecycleEventCount: 1, version: 1,
      }] })];

    await expect(useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "history-shape", expectedVersion: 1, changes: { startsAt: "2026-08-03T10:00:00Z" } }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repository.replacedInteractions).toBeUndefined();

    await useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "history-title", expectedVersion: 1, changes: { title: "Novo título" } });
    expect(repository.updated?.changes).toMatchObject({ title: "Novo título" });
  });

  it("rejects materialized series shape edits after progress or linked orders but allows title-only edits", async () => {
    const repository = new FakeCalendarRepository();
    const useCase = new UpdateCalendarEventUseCase({ repository });
    repository.events = [baseEvent({ kind: "INTERACTION", facility: { id: 1, name: "Clínica Central" }, interactions: [{
      id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "IN_PROGRESS",
      visitId: null, linkedOrderCount: 0, version: 2,
    }] })];
    await expect(useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "progressed", expectedVersion: 1, changes: { recurrence: "DAILY", recurrenceCount: 2 } }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    repository.events[0] = baseEvent({ kind: "INTERACTION", facility: { id: 1, name: "Clínica Central" }, interactions: [{
      id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED",
      visitId: null, linkedOrderCount: 1, version: 1,
    }] });
    await expect(useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "order-linked", expectedVersion: 1, changes: { durationMinutes: 30 } }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "title", expectedVersion: 1, changes: { title: "Novo título" } });
    expect(repository.updated?.changes).toMatchObject({ title: "Novo título" });
  });

  it("replays a create command without executing the business write twice", async () => {
    const repository = new FakeCalendarRepository();
    const useCase = new CreateCalendarEventUseCase({ repository });
    const input = { actor: { userId: 1, roleName: "REP" as const }, scope: repScope,
      idempotencyKey: "same-create", data: createInteraction };

    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(second).toEqual(first);
    expect(repository.createCalls).toBe(1);
  });

  it("rejects same-owner idempotency key reuse with a different create payload", async () => {
    const repository = new FakeCalendarRepository();
    const useCase = new CreateCalendarEventUseCase({ repository });
    await useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      idempotencyKey: "same-key", data: createInteraction });

    await expect(useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      idempotencyKey: "same-key", data: { ...createInteraction, title: "Outra visita" } }))
      .rejects.toBeInstanceOf(CalendarIdempotencyConflictError);
    expect(repository.createCalls).toBe(1);
  });

  it("rejects cross-resource and cross-command idempotency key reuse", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent(), baseEvent({ id: 2, title: "Outro", anchorLocalDate: "2026-08-05",
      firstStartsAt: new Date("2026-08-05T09:00:00Z"), firstEndsAt: new Date("2026-08-05T10:00:00Z") })];
    const update = new UpdateCalendarEventUseCase({ repository });
    await update.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "shared-key", expectedVersion: 1, changes: { title: "Primeiro" } });

    await expect(update.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 2, idempotencyKey: "shared-key", expectedVersion: 1, changes: { title: "Segundo" } }))
      .rejects.toMatchObject({ code: "CALENDAR_IDEMPOTENCY_CONFLICT", statusCode: 409 });

    await expect(new CancelCalendarEventUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "shared-key", expectedVersion: 2, reason: "Cancelado" }))
      .rejects.toMatchObject({ code: "CALENDAR_IDEMPOTENCY_CONFLICT", statusCode: 409 });
  });

  it("soft-cancels and preserves the trimmed reason while replaying retries", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()];
    const useCase = new CancelCalendarEventUseCase({ repository });
    const input = { actor: { userId: 1, roleName: "REP" as const }, scope: repScope, id: 1,
      idempotencyKey: "same-cancel", expectedVersion: 1, reason: "  compromisso cancelado " };

    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(second).toEqual(first);
    expect(repository.cancelCalls).toBe(1);
    expect(repository.events[0]).toMatchObject({ status: "CANCELLED", cancellationReason: "compromisso cancelado" });
  });

  it("cancels every materialized scheduled interaction in a series transactionally", async () => {
    const repository = new FakeCalendarRepository();
    repository.events = [baseEvent({ kind: "INTERACTION", recurrence: "DAILY", recurrenceCount: 2,
      facility: { id: 1, name: "Clínica Central" }, interactions: [
        { id: 10, recurrenceKey: "2026-08-03T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1 },
        { id: 11, recurrenceKey: "2026-08-04T09:00[UTC]", facilityId: 1, modality: "REMOTE", status: "SCHEDULED", version: 1 },
      ] })];

    await new CancelCalendarEventUseCase({ repository }).execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope,
      id: 1, idempotencyKey: "cancel-series", expectedVersion: 1, reason: " Plano alterado " });

    expect(repository.events[0]?.status).toBe("CANCELLED");
    expect(repository.events[0]?.interactions.map((item) => item.status)).toEqual(["CANCELLED", "CANCELLED"]);
    expect(repository.cancelledInteractions).toEqual([
      { recurrenceKey: "2026-08-03T09:00[UTC]", actorUserId: 1, reason: "Plano alterado" },
      { recurrenceKey: "2026-08-04T09:00[UTC]", actorUserId: 1, reason: "Plano alterado" },
    ]);
  });

  it("requires a trimmed cancellation reason and soft-cancels an owned active series with expectedVersion", async () => {
    const repository = new FakeCalendarRepository(); repository.events = [baseEvent()];
    const useCase = new CancelCalendarEventUseCase({ repository });
    await expect(useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope, id: 1,
      idempotencyKey: "cmd", expectedVersion: 1, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    await useCase.execute({ actor: { userId: 1, roleName: "REP" }, scope: repScope, id: 1,
      idempotencyKey: "cmd", expectedVersion: 1, reason: "  compromisso cancelado " });
    expect(repository.deleted).toEqual({ id: 1, expectedVersion: 1, actorUserId: 1, reason: "compromisso cancelado", commandKey: "cmd" });
  });
});
