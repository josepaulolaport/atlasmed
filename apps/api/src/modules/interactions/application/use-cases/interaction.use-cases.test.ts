import { describe, expect, test } from "bun:test";
import type { Role, ScopeContext } from "@atlasmed/access";
import type {
  InteractionDetailRecord,
  InteractionRepository,
} from "../interfaces/interaction.repository.interface";
import {
  CompleteInteractionUseCase,
  GetInteractionUseCase,
  InteractionTransitionError,
  InteractionVersionConflictError,
  MarkOverdueInteractionsUseCase,
  StartInteractionUseCase,
} from "./interaction.use-cases";

const now = new Date("2026-08-03T12:00:00.000Z");

function scope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    isGlobal: false,
    assignedTerritoryIds: [],
    effectiveTerritoryIds: [],
    analyticsEffectiveTerritoryIds: [],
    territoryIds: [],
    facilityIds: ["facility-1"],
    analyticsFacilityIds: ["facility-1"],
    clinicIds: ["facility-1"],
    analyticsClinicIds: ["facility-1"],
    managedUserIds: [],
    isOperationallyActive: true,
    ...overrides,
  };
}

function interaction(overrides: Partial<InteractionDetailRecord> = {}): InteractionDetailRecord {
  return {
    id: "interaction-1",
    calendarId: "calendar-1",
    recurrenceKey: "2026-08-03T09:00[America/Sao_Paulo]",
    facilityId: "facility-1",
    agentUserId: "rep-1",
    modality: "IN_PERSON",
    status: "SCHEDULED",
    actualStartedAt: null,
    actualEndedAt: null,
    correctedAt: null,
    correctedByUserId: null,
    correctionReason: null,
    visitId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    calendar: {
      ownerUserId: "rep-1",
      title: "Visita",
      anchorLocalDate: "2026-08-03",
      anchorLocalTime: "09:00",
      timeZone: "America/Sao_Paulo",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceUntil: null,
      recurrenceCount: null,
    },
    occurrenceOverride: null,
    facility: { id: "facility-1", displayName: "Clínica Central", city: "São Paulo", state: "SP" },
    agent: { id: "rep-1", firstName: "Ana", lastName: "Silva" },
    linkedOrders: [],
    ...overrides,
  };
}

class FakeInteractionRepository implements InteractionRepository {
  record: InteractionDetailRecord | null = interaction();
  visits = 0;
  events: Array<{ previousStatus: string; newStatus: string; reason?: string }> = [];
  receipts = new Map<string, InteractionDetailRecord>();
  overdueCount = 0;

  async findCommandResult(input: { command: "start" | "complete"; idempotencyKey: string }) {
    return this.receipts.get(`${input.command}:${input.idempotencyKey}`) ?? null;
  }

  async findById() { return this.record; }

  async start(input: { expectedVersion: number; idempotencyKey: string; startedAt: Date }) {
    const replay = this.receipts.get(`start:${input.idempotencyKey}`);
    if (replay) return { interaction: replay, replayed: true };
    if (!this.record || this.record.version !== input.expectedVersion || this.record.status !== "SCHEDULED") return null;
    const previousStatus = this.record.status;
    this.record = { ...this.record, status: "IN_PROGRESS", actualStartedAt: input.startedAt, version: this.record.version + 1, updatedAt: input.startedAt };
    this.events.push({ previousStatus, newStatus: "IN_PROGRESS" });
    this.receipts.set(`start:${input.idempotencyKey}`, this.record);
    return { interaction: this.record, replayed: false };
  }

  async complete(input: { expectedVersion: number; idempotencyKey: string; completedAt: Date; actorUserId: string; correctionReason?: string }) {
    const replay = this.receipts.get(`complete:${input.idempotencyKey}`);
    if (replay) return { interaction: replay, replayed: true };
    if (!this.record || this.record.version !== input.expectedVersion || !["IN_PROGRESS", "NOT_COMPLETED"].includes(this.record.status)) return null;
    const previousStatus = this.record.status;
    const corrected = previousStatus === "NOT_COMPLETED";
    const visitId = this.record.visitId ?? `visit-${this.visits + 1}`;
    if (!this.record.visitId) this.visits += 1;
    this.record = {
      ...this.record,
      status: "COMPLETED",
      actualEndedAt: input.completedAt,
      correctedAt: corrected ? input.completedAt : null,
      correctedByUserId: corrected ? input.actorUserId : null,
      correctionReason: corrected ? input.correctionReason ?? null : null,
      visitId,
      version: this.record.version + 1,
      updatedAt: input.completedAt,
    };
    this.events.push({ previousStatus, newStatus: "COMPLETED", ...(input.correctionReason ? { reason: input.correctionReason } : {}) });
    this.receipts.set(`complete:${input.idempotencyKey}`, this.record);
    return { interaction: this.record, replayed: false };
  }

  async markOverdue(input: { now: Date; limit: number }) {
    if (!this.record || this.record.status !== "SCHEDULED" || this.overdueCount >= input.limit) return 0;
    const endsAt = this.record.occurrenceOverride?.endsAt ?? new Date("2026-08-03T13:00:00.000Z");
    if (endsAt >= input.now) return 0;
    const previousStatus = this.record.status;
    this.record = { ...this.record, status: "NOT_COMPLETED", version: this.record.version + 1, updatedAt: input.now };
    this.events.push({ previousStatus, newStatus: "NOT_COMPLETED" });
    this.overdueCount += 1;
    return 1;
  }
}

function executeGet(repository: InteractionRepository, roleName: Role, actorScope: ScopeContext) {
  return new GetInteractionUseCase({ repository }).execute({
    id: "interaction-1",
    actor: { userId: roleName === "MANAGER" ? "manager-1" : "rep-1", roleName },
    scope: actorScope,
  });
}

describe("GetInteractionUseCase", () => {
  test("returns occurrence, facility, agent, order context, and owner mutation capability", async () => {
    const result = await executeGet(new FakeInteractionRepository(), "REP", scope());

    expect(result).toEqual(expect.objectContaining({
      id: "interaction-1",
      status: "SCHEDULED",
      canMutate: true,
      occurrence: {
        recurrenceKey: "2026-08-03T09:00[America/Sao_Paulo]",
        startsAt: "2026-08-03T12:00:00.000Z",
        endsAt: "2026-08-03T13:00:00.000Z",
        timeZone: "America/Sao_Paulo",
      },
      facility: { id: "facility-1", displayName: "Clínica Central", city: "São Paulo", state: "SP" },
      linkedOrders: [],
    }));
  });

  test("allows a manager to read only a managed agent in facility scope", async () => {
    const result = await executeGet(new FakeInteractionRepository(), "MANAGER", scope({ managedUserIds: ["rep-1"] }));
    expect(result.canMutate).toBe(false);
  });

  test("denies an unmanaged agent or facility outside scope", async () => {
    await expect(executeGet(new FakeInteractionRepository(), "MANAGER", scope())).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    await expect(executeGet(new FakeInteractionRepository(), "REP", scope({ facilityIds: [] }))).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});

function ownerInput() {
  return { id: "interaction-1", actor: { userId: "rep-1", roleName: "REP" as const }, scope: scope(), expectedVersion: 1, idempotencyKey: "cmd-1" };
}

describe("StartInteractionUseCase", () => {
  test("starts a scheduled interaction immediately, even before its scheduled time", async () => {
    const repository = new FakeInteractionRepository();
    const result = await new StartInteractionUseCase({ repository, now: () => new Date("2026-08-03T11:00:00.000Z") }).execute(ownerInput());
    expect(result).toEqual(expect.objectContaining({ status: "IN_PROGRESS", actualStartedAt: "2026-08-03T11:00:00.000Z", version: 2 }));
    expect(repository.events).toEqual([{ previousStatus: "SCHEDULED", newStatus: "IN_PROGRESS" }]);
  });

  test("rejects manager mutation, invalid transitions, and stale versions with typed errors", async () => {
    const repository = new FakeInteractionRepository();
    await expect(new StartInteractionUseCase({ repository }).execute({ ...ownerInput(), actor: { userId: "manager-1", roleName: "MANAGER" }, scope: scope({ managedUserIds: ["rep-1"] }) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    repository.record = interaction({ status: "IN_PROGRESS" });
    await expect(new StartInteractionUseCase({ repository }).execute(ownerInput())).rejects.toBeInstanceOf(InteractionTransitionError);
    repository.record = interaction({ version: 2 });
    await expect(new StartInteractionUseCase({ repository }).execute(ownerInput())).rejects.toBeInstanceOf(InteractionVersionConflictError);
  });
});

describe("CompleteInteractionUseCase", () => {
  test("completes an in-progress interaction and creates exactly one compatibility visit across retries", async () => {
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ status: "IN_PROGRESS", actualStartedAt: new Date("2026-08-03T11:30:00.000Z") });
    const useCase = new CompleteInteractionUseCase({ repository, now: () => new Date("2026-08-03T12:15:00.000Z") });
    const first = await useCase.execute(ownerInput());
    const retry = await useCase.execute(ownerInput());
    expect(first).toEqual(expect.objectContaining({ status: "COMPLETED", visitId: "visit-1" }));
    expect(retry).toEqual(first);
    expect(repository.visits).toBe(1);
    expect(repository.events).toHaveLength(1);
  });

  test("requires and trims a correction reason for NOT_COMPLETED -> COMPLETED", async () => {
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ status: "NOT_COMPLETED" });
    const useCase = new CompleteInteractionUseCase({ repository, now: () => new Date("2026-08-03T14:00:00.000Z") });
    await expect(useCase.execute(ownerInput())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const result = await useCase.execute({ ...ownerInput(), correctionReason: "  Cliente confirmou visita  " });
    expect(result).toEqual(expect.objectContaining({
      status: "COMPLETED",
      correctionReason: "Cliente confirmou visita",
      correctedByUserId: "rep-1",
      actualEndedAt: "2026-08-03T14:00:00.000Z",
    }));
  });

  test("does not complete a scheduled interaction directly", async () => {
    await expect(new CompleteInteractionUseCase({ repository: new FakeInteractionRepository() }).execute(ownerInput())).rejects.toBeInstanceOf(InteractionTransitionError);
  });
});

describe("MarkOverdueInteractionsUseCase", () => {
  test("marks only ended scheduled interactions and leaves in-progress interactions untouched", async () => {
    const scheduled = new FakeInteractionRepository();
    const useCase = new MarkOverdueInteractionsUseCase({ repository: scheduled, systemActorUserId: "system", now: () => new Date("2026-08-03T13:01:00.000Z") });
    expect(await useCase.execute({ limit: 25 })).toBe(1);
    expect(scheduled.record?.status).toBe("NOT_COMPLETED");
    expect(scheduled.events).toEqual([{ previousStatus: "SCHEDULED", newStatus: "NOT_COMPLETED" }]);

    const inProgress = new FakeInteractionRepository();
    inProgress.record = interaction({ status: "IN_PROGRESS" });
    expect(await new MarkOverdueInteractionsUseCase({ repository: inProgress, systemActorUserId: "system" }).execute({ now: new Date("2026-08-03T20:00:00.000Z") })).toBe(0);
    expect(inProgress.record.status).toBe("IN_PROGRESS");
  });
});
