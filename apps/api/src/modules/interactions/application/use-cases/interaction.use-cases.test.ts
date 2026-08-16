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
  MarkInteractionMissedUseCase,
  MarkOverdueInteractionsUseCase,
  RecordArrivalUseCase,
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
    facilityIds: [1],
    analyticsFacilityIds: [1],
    clinicIds: [1],
    analyticsClinicIds: [1],
    managedUserIds: [],
    isOperationallyActive: true,
    ...overrides,
  };
}

function interaction(overrides: Partial<InteractionDetailRecord> = {}): InteractionDetailRecord {
  return {
    id: 10,
    calendarId: 1,
    recurrenceKey: "2026-08-03T09:00[America/Sao_Paulo]",
    facilityId: 1,
    personId: null,
    agentUserId: 1,
    modality: "IN_PERSON",
    status: "SCHEDULED",
    actualStartedAt: null,
  outcome: null,
  followUp: null,
  missReason: null,
  outcomeAnsweredAt: null,
    actualEndedAt: null,
    correctedAt: null,
    correctedByUserId: null,
    correctionReason: null,
    visitId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    calendar: {
      ownerUserId: 1,
      title: "Visita",
      anchorLocalDate: "2026-08-03",
      anchorLocalTime: "09:00",
      timeZone: "America/Sao_Paulo",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceUntil: null,
      recurrenceCount: null,
      status: "ACTIVE",
      version: 3,
    },
    occurrenceOverride: null,
    facility: { id: 1, displayName: "Clínica Central", city: "São Paulo", state: "SP" },
    person: null,
    agent: { id: 1, firstName: "Ana", lastName: "Silva" },
    agentWorkdayEnd: null,
    linkedOrders: [],
    ...overrides,
  };
}

class FakeInteractionRepository implements InteractionRepository {
  record: InteractionDetailRecord | null = interaction();
  visits = 0;
  events: Array<{ previousStatus: string; newStatus: string; reason?: string; source?: string; actorUserId?: string | null }> = [];
  receipts = new Map<string, InteractionDetailRecord>();
  overdueCount = 0;

  async findCommandResult(input: { command: "start" | "complete"; idempotencyKey: string }) {
    return this.receipts.get(`${input.command}:${input.idempotencyKey}`) ?? null;
  }

  async findById() { return this.record; }

  /** The visit already booked at this clinic today, when a test seeds one. */
  plannedVisit: InteractionDetailRecord | null = null;
  async findPlannedVisitAt() { return this.plannedVisit; }

  async start(input: { expectedVersion: number; idempotencyKey: string; startedAt: Date }) {
    const replay = this.receipts.get(`start:${input.idempotencyKey}`);
    if (replay) return { interaction: replay, replayed: true };
    // SCHEDULED or NOT_COMPLETED — the table accepts both, because a rep who
    // turns up late reopens the visit rather than correcting it.
    if (!this.record || this.record.version !== input.expectedVersion
      || !["SCHEDULED", "NOT_COMPLETED"].includes(this.record.status)) return null;
    const previousStatus = this.record.status;
    this.record = { ...this.record, status: "IN_PROGRESS", actualStartedAt: input.startedAt, version: this.record.version + 1, updatedAt: input.startedAt };
    this.events.push({ previousStatus, newStatus: "IN_PROGRESS" });
    this.receipts.set(`start:${input.idempotencyKey}`, this.record);
    return { interaction: this.record, replayed: false };
  }

  async complete(input: { expectedVersion: number; idempotencyKey: string; completedAt: Date; actorUserId: number; correctionReason?: string; scheduledStartsAt?: Date; persistEffectiveMissed?: boolean }) {
    const replay = this.receipts.get(`complete:${input.idempotencyKey}`);
    if (replay) return { interaction: replay, replayed: true };
    if (!this.record || this.record.version !== input.expectedVersion || (!["IN_PROGRESS", "NOT_COMPLETED"].includes(this.record.status) && !(input.persistEffectiveMissed && this.record.status === "SCHEDULED"))) return null;
    const previousStatus = input.persistEffectiveMissed && this.record.status === "SCHEDULED" ? "NOT_COMPLETED" : this.record.status;
    if (input.persistEffectiveMissed && this.record.status === "SCHEDULED") {
      this.events.push({ previousStatus: "SCHEDULED", newStatus: "NOT_COMPLETED", source: "SYSTEM", actorUserId: null });
    }
    const corrected = previousStatus === "NOT_COMPLETED";
    const visitId = this.record.visitId ?? 100 + this.visits;
    if (!this.record.visitId) this.visits += 1;
    const actualStartedAt = corrected
      ? input.scheduledStartsAt ?? new Date(input.completedAt.getTime() - 1)
      : this.record.actualStartedAt;
    this.record = {
      ...this.record,
      status: "COMPLETED",
      actualStartedAt,
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

  arrivals: Array<Parameters<InteractionRepository["recordArrival"]>[0]> = [];
  facility: { id: number; displayName: string } | null = { id: 1, displayName: "Clínica Central" };

  async findFacilitySummary() { return this.facility; }

  async findArrival(input: { idempotencyKey: string }) {
    return this.receipts.get(`arrival:${input.idempotencyKey}`) ?? null;
  }

  async recordArrival(input: Parameters<InteractionRepository["recordArrival"]>[0]) {
    this.arrivals.push(input);
    this.record = interaction({
      id: 11,
      facilityId: input.facilityId,
      agentUserId: input.agentUserId,
      status: "IN_PROGRESS",
      actualStartedAt: input.startedAt,
      recurrenceKey: input.recurrenceKey,
      calendar: {
        ownerUserId: input.agentUserId, title: input.title,
        anchorLocalDate: input.anchorLocalDate, anchorLocalTime: input.anchorLocalTime,
        timeZone: input.timeZone, durationMinutes: input.durationMinutes,
        recurrence: "NONE", recurrenceUntil: null, recurrenceCount: null,
        status: "ACTIVE", version: 1,
      },
    });
    this.receipts.set(`arrival:${input.idempotencyKey}`, this.record);
    return this.record;
  }

  async closeStaleVisits(): Promise<number> {
    return 0;
  }
  async markMissed(input: { expectedVersion: number; actorUserId: number; reason?: string; at: Date }) {
    if (!this.record || this.record.version !== input.expectedVersion) return null;
    const previousStatus = this.record.status;
    this.record = { ...this.record, status: "NOT_COMPLETED", missReason: (input.reason ?? null) as never,
      version: this.record.version + 1, updatedAt: input.at };
    this.events.push({ previousStatus, newStatus: "NOT_COMPLETED", ...(input.reason ? { reason: input.reason } : {}) });
    return this.record;
  }
  async recordOutcome(): Promise<null> {
    return null;
  }
  async markOverdue(input: { now: Date; limit: number }) {
    if (!this.record || this.record.status !== "SCHEDULED" || this.overdueCount >= input.limit) return 0;
    const endsAt = this.record.occurrenceOverride?.endsAt ?? new Date("2026-08-03T13:00:00.000Z");
    if (endsAt > input.now) return 0;
    const previousStatus = this.record.status;
    this.record = { ...this.record, status: "NOT_COMPLETED", version: this.record.version + 1, updatedAt: input.now };
    this.events.push({ previousStatus, newStatus: "NOT_COMPLETED" });
    this.overdueCount += 1;
    return 1;
  }
}

function executeGet(repository: InteractionRepository, roleName: Role, actorScope: ScopeContext, clock = () => now) {
  return new GetInteractionUseCase({ repository, now: clock }).execute({
    id: 10,
    actor: { userId: roleName === "MANAGER" ? 2 : 1, roleName },
    scope: actorScope,
  });
}

describe("GetInteractionUseCase", () => {
  test("returns occurrence, facility, agent, order context, and owner mutation capability", async () => {
    const result = await executeGet(new FakeInteractionRepository(), "REP", scope(), () => new Date("2026-08-03T12:00:00.000Z"));

    expect(result).toEqual(expect.objectContaining({
      id: 10,
      calendarId: 1,
      calendarVersion: 3,
      recurrenceKey: "2026-08-03T09:00[America/Sao_Paulo]",
      status: "SCHEDULED",
      canMutate: true,
      occurrence: {
        recurrenceKey: "2026-08-03T09:00[America/Sao_Paulo]",
        startsAt: "2026-08-03T12:00:00.000Z",
        endsAt: "2026-08-03T13:00:00.000Z",
        timeZone: "America/Sao_Paulo",
      },
      facility: { id: 1, displayName: "Clínica Central", city: "São Paulo", state: "SP" },
      linkedOrders: [],
    }));
  });

  test("returns recurrence fields in the calendar DTO for the mobile editor", async () => {
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ calendar: { ...interaction().calendar, recurrence: "WEEKLY", recurrenceUntil: "2026-09-30", recurrenceCount: null } });
    const result = await executeGet(repository, "REP", scope());
    expect(result.calendar).toEqual({
      id: 1,
      title: "Visita",
      version: 3,
      recurrence: "WEEKLY",
      recurrenceUntil: "2026-09-30",
      recurrenceCount: null,
    });
  });

  test("a visit whose window has passed is still today's visit", async () => {
    // 09:00–10:00 local, read at 10:00:00.001. It used to flip to
    // NOT_COMPLETED on the instant, which made running late — the most
    // ordinary thing that happens to a day — unrecordable except as a
    // correction.
    const repository = new FakeInteractionRepository();
    const result = await new GetInteractionUseCase({ repository, now: () => new Date("2026-08-03T13:00:00.001Z") }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    });
    expect(result.status).toBe("SCHEDULED");
  });

  test("derives missed once the rep's working day is over", async () => {
    // 18:00 in America/Sao_Paulo is 21:00Z. A minute later the day is done and
    // recording the visit becomes what it now really is: a correction.
    const repository = new FakeInteractionRepository();
    const result = await new GetInteractionUseCase({ repository, now: () => new Date("2026-08-03T21:00:00.001Z") }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    });
    expect(result.status).toBe("NOT_COMPLETED");
  });

  test("the rep's own end of day is what counts", async () => {
    // A rep who stops at 16:00 has their visits swept three hours earlier than
    // one who stops at 18:00 (§15.5.5 — the workday is the rep's, not the
    // server's).
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ agentWorkdayEnd: "16:00" });
    const result = await new GetInteractionUseCase({ repository, now: () => new Date("2026-08-03T19:00:00.001Z") }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    });
    expect(result.status).toBe("NOT_COMPLETED");
  });

  test("derives missed and cancelled effective states without persisting on read", async () => {
    const overdue = new FakeInteractionRepository();
    const overdueResult = await new GetInteractionUseCase({ repository: overdue, now: () => new Date("2026-08-03T21:00:00.001Z") }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    });
    expect(overdueResult).toEqual(expect.objectContaining({ status: "NOT_COMPLETED", canMutate: true }));
    expect(overdue.record?.status).toBe("SCHEDULED");

    const cancelledSeries = new FakeInteractionRepository();
    cancelledSeries.record = interaction({ calendar: { ...interaction().calendar, status: "CANCELLED", version: 4 } });
    expect(await new GetInteractionUseCase({ repository: cancelledSeries, now: () => now }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    })).toEqual(expect.objectContaining({ status: "CANCELLED", canMutate: false, calendarVersion: 4 }));

    const cancelledOverride = new FakeInteractionRepository();
    cancelledOverride.record = interaction({ occurrenceOverride: {
      startsAt: new Date("2026-08-03T12:00:00.000Z"), endsAt: new Date("2026-08-03T13:00:00.000Z"), status: "CANCELLED", version: 2,
    } });
    expect(await new GetInteractionUseCase({ repository: cancelledOverride, now: () => now }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
    })).toEqual(expect.objectContaining({ status: "CANCELLED", canMutate: false, overrideVersion: 2 }));
  });

  test("allows a manager to read only a managed agent in facility scope", async () => {
    const result = await executeGet(new FakeInteractionRepository(), "MANAGER", scope({ managedUserIds: [1] }));
    expect(result.canMutate).toBe(false);
  });

  test("denies an unmanaged agent or facility outside scope", async () => {
    await expect(executeGet(new FakeInteractionRepository(), "MANAGER", scope())).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    await expect(executeGet(new FakeInteractionRepository(), "REP", scope({ facilityIds: [] }))).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});

function ownerInput() {
  return { id: 10, actor: { userId: 1, roleName: "REP" as const }, scope: scope(), expectedVersion: 1, idempotencyKey: "cmd-1" };
}

describe("StartInteractionUseCase", () => {
  test("starts a scheduled interaction immediately, even before its scheduled time", async () => {
    const repository = new FakeInteractionRepository();
    const result = await new StartInteractionUseCase({ repository, now: () => new Date("2026-08-03T11:00:00.000Z") }).execute(ownerInput());
    expect(result).toEqual(expect.objectContaining({ status: "IN_PROGRESS", actualStartedAt: "2026-08-03T11:00:00.000Z", version: 2 }));
    expect(repository.events).toEqual([{ previousStatus: "SCHEDULED", newStatus: "IN_PROGRESS" }]);
  });

  test("starts a visit the rep reached late, and reopens one already marked missed", async () => {
    // Both are the same fact from two directions: the rep is in the clinic.
    // A system that refuses the record because its own clock moved on is the
    // one §15.6.5 warns about — it can only record what it suggested.
    const late = new FakeInteractionRepository();
    await expect(new StartInteractionUseCase({ repository: late, now: () => new Date("2026-08-03T13:00:00.001Z") }).execute(ownerInput()))
      .resolves.toBeDefined();

    const swept = new FakeInteractionRepository();
    swept.record = interaction({ status: "NOT_COMPLETED" });
    await expect(new StartInteractionUseCase({ repository: swept, now: () => new Date("2026-08-03T21:30:00.000Z") }).execute(ownerInput()))
      .resolves.toBeDefined();
  });

  test("rejects start when calendar/override cancellation makes a stale row cancelled", async () => {

    const cancelledSeries = new FakeInteractionRepository();
    cancelledSeries.record = interaction({ calendar: { ...interaction().calendar, status: "CANCELLED", version: 4 } });
    await expect(new StartInteractionUseCase({ repository: cancelledSeries, now: () => now }).execute(ownerInput()))
      .rejects.toBeInstanceOf(InteractionTransitionError);

    const cancelledOverride = new FakeInteractionRepository();
    cancelledOverride.record = interaction({ occurrenceOverride: {
      startsAt: new Date("2026-08-03T12:00:00.000Z"), endsAt: new Date("2026-08-03T13:00:00.000Z"), status: "CANCELLED", version: 2,
    } });
    await expect(new StartInteractionUseCase({ repository: cancelledOverride, now: () => now }).execute(ownerInput()))
      .rejects.toBeInstanceOf(InteractionTransitionError);
  });

  test("rejects manager mutation, invalid transitions, and stale versions with typed errors", async () => {
    const repository = new FakeInteractionRepository();
    const useCase = new StartInteractionUseCase({ repository, now: () => now });
    await expect(useCase.execute({ ...ownerInput(), actor: { userId: 2, roleName: "MANAGER" }, scope: scope({ managedUserIds: [1] }) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    repository.record = interaction({ status: "IN_PROGRESS" });
    await expect(useCase.execute(ownerInput())).rejects.toBeInstanceOf(InteractionTransitionError);
    repository.record = interaction({ version: 2 });
    await expect(useCase.execute(ownerInput())).rejects.toBeInstanceOf(InteractionVersionConflictError);
  });
});

describe("CompleteInteractionUseCase", () => {
  test("completes an in-progress interaction and creates exactly one compatibility visit across retries", async () => {
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ status: "IN_PROGRESS", actualStartedAt: new Date("2026-08-03T11:30:00.000Z") });
    const useCase = new CompleteInteractionUseCase({ repository, now: () => new Date("2026-08-03T12:15:00.000Z") });
    const first = await useCase.execute(ownerInput());
    const retry = await useCase.execute(ownerInput());
    expect(first).toEqual(expect.objectContaining({ status: "COMPLETED", visitId: 100 }));
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
      correctedByUserId: 1,
      actualStartedAt: "2026-08-03T12:00:00.000Z",
      actualEndedAt: "2026-08-03T14:00:00.000Z",
    }));
  });

  test("uses completion minus 1ms when a corrected missed interaction completes before its scheduled start", async () => {
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ status: "NOT_COMPLETED", occurrenceOverride: {
      startsAt: new Date("2026-08-03T15:00:00.000Z"), endsAt: new Date("2026-08-03T16:00:00.000Z"), status: "ACTIVE", version: 1,
    } });
    const result = await new CompleteInteractionUseCase({ repository, now: () => new Date("2026-08-03T14:00:00.000Z") }).execute({
      ...ownerInput(), correctionReason: "Correção administrativa",
    });
    expect(result.actualStartedAt).toBe("2026-08-03T13:59:59.999Z");
    expect(result.actualEndedAt).toBe("2026-08-03T14:00:00.000Z");
  });

  test("atomically persists an effective missed transition before correcting a read-derived scheduled row", async () => {
    const repository = new FakeInteractionRepository();
    // After the working day: a visit recorded now really is a correction, and
    // that is the one case where the justification belongs.
    const result = await new CompleteInteractionUseCase({ repository, now: () => new Date("2026-08-03T21:30:00.000Z") }).execute({
      ...ownerInput(), correctionReason: "  Visita confirmada  ",
    });

    expect(result).toEqual(expect.objectContaining({ status: "COMPLETED", visitId: 100, correctionReason: "Visita confirmada" }));
    expect(repository.events).toEqual([
      { previousStatus: "SCHEDULED", newStatus: "NOT_COMPLETED", source: "SYSTEM", actorUserId: null },
      { previousStatus: "NOT_COMPLETED", newStatus: "COMPLETED", reason: "Visita confirmada" },
    ]);
    expect(repository.visits).toBe(1);
  });

  test("does not complete a visit that was never started while the day is still open", async () => {
    // Including one whose window has passed: until the day ends it is still a
    // visit the rep can walk into, so the honest press is Cheguei, not a
    // silent completion of something nobody witnessed.
    await expect(new CompleteInteractionUseCase({ repository: new FakeInteractionRepository(), now: () => new Date("2026-08-03T12:59:59.999Z") }).execute(ownerInput()))
      .rejects.toBeInstanceOf(InteractionTransitionError);
    await expect(new CompleteInteractionUseCase({ repository: new FakeInteractionRepository(), now: () => new Date("2026-08-03T14:00:00.000Z") }).execute(ownerInput()))
      .rejects.toBeInstanceOf(InteractionTransitionError);
  });
});

describe("MarkOverdueInteractionsUseCase", () => {
  test("marks only ended scheduled interactions and leaves in-progress interactions untouched", async () => {
    const scheduled = new FakeInteractionRepository();
    const useCase = new MarkOverdueInteractionsUseCase({ repository: scheduled, systemActorUserId: null, now: () => new Date("2026-08-03T13:01:00.000Z") });
    expect(await useCase.execute({ limit: 25 })).toBe(1);
    expect(scheduled.record?.status).toBe("NOT_COMPLETED");
    expect(scheduled.events).toEqual([{ previousStatus: "SCHEDULED", newStatus: "NOT_COMPLETED" }]);

    const exactBoundary = new FakeInteractionRepository();
    expect(await new MarkOverdueInteractionsUseCase({ repository: exactBoundary }).execute({ now: new Date("2026-08-03T13:00:00.000Z") })).toBe(1);
    expect(exactBoundary.record?.status).toBe("NOT_COMPLETED");

    const inProgress = new FakeInteractionRepository();
    inProgress.record = interaction({ status: "IN_PROGRESS" });
    expect(await new MarkOverdueInteractionsUseCase({ repository: inProgress, systemActorUserId: null }).execute({ now: new Date("2026-08-03T20:00:00.000Z") })).toBe(0);
    expect(inProgress.record.status).toBe("IN_PROGRESS");
  });
});

describe("MarkInteractionMissedUseCase", () => {
  const missed = (repository: FakeInteractionRepository, reason?: "FECHADA" | "SEM_TEMPO", at = "2026-08-03T14:00:00.000Z") =>
    new MarkInteractionMissedUseCase({ repository, now: () => new Date(at) }).execute({
      id: 10, actor: { userId: 1, roleName: "REP" }, scope: scope(),
      expectedVersion: repository.record?.version ?? 1, ...(reason ? { reason } : {}),
    });

  test("records why a planned visit did not happen", async () => {
    // A miss used to be inferred only: the day ended, a sweep wrote
    // NOT_COMPLETED, and nothing said whether the clinic was shut or the day
    // simply ran out. The engine then proposed it again at the same merit.
    const repository = new FakeInteractionRepository();

    const result = await missed(repository, "FECHADA");

    expect(result.status).toBe("NOT_COMPLETED");
    expect(result.missReason).toBe("FECHADA");
    expect(repository.events.at(-1)).toMatchObject({ newStatus: "NOT_COMPLETED", reason: "FECHADA" });
  });

  test("takes the miss without a reason", async () => {
    // Offered, never required: made to answer, a rep in a hurry presses
    // nothing at all — and the sweep marks it missed with no reason anyway.
    const repository = new FakeInteractionRepository();

    const result = await missed(repository);

    expect(result.status).toBe("NOT_COMPLETED");
    expect(result.missReason).toBeNull();
  });

  test("refuses to call a visit that happened a miss", async () => {
    // Completed or in progress is a record of something real; overwriting it
    // would throw away a measurement.
    const repository = new FakeInteractionRepository();
    repository.record = interaction({ status: "IN_PROGRESS", actualStartedAt: new Date("2026-08-03T12:10:00.000Z") });

    await expect(missed(repository, "SEM_TEMPO")).rejects.toBeInstanceOf(InteractionTransitionError);
  });
});

describe("RecordArrivalUseCase", () => {
  const arrive = (repository: InteractionRepository, roleName: Role = "REP", actorScope = scope(), clock = () => now) =>
    new RecordArrivalUseCase({ repository, now: clock }).execute({
      facilityId: 1,
      timeZone: "America/Sao_Paulo",
      actor: { userId: 1, roleName },
      scope: actorScope,
      idempotencyKey: "arrival-key",
    });

  test("records a visit to a clinic that was never on the roteiro, already started", async () => {
    // §15.6.3: reps improvise, and a system that can only record its own
    // suggestions under-counts real work and then concludes reps are not
    // visiting. There is no scheduled appointment to start.
    const repository = new FakeInteractionRepository();

    const result = await arrive(repository);

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.actualStartedAt).toBe(now.toISOString());
    expect(repository.arrivals).toHaveLength(1);
    expect(repository.arrivals[0]?.title).toBe("Visita · Clínica Central");
  });

  test("starts the visit the rep already had booked at that clinic today", async () => {
    // Arrival used to always mint a second row, so pressing Cheguei from the
    // clinic's page rather than the agenda left the day holding an improvised
    // visit that was measured *and* a planned one that rotted to
    // NOT_COMPLETED — one hour in one building, counted twice and missed once.
    const repository = new FakeInteractionRepository();
    // The fake's start() mutates whatever `record` holds, so both point at the
    // booked visit — which is the situation being described.
    repository.record = interaction({ id: 77, version: 5 });
    repository.plannedVisit = repository.record;

    const result = await arrive(repository);

    expect(result.id).toBe(77);
    expect(result.status).toBe("IN_PROGRESS");
    // Nothing improvised: no second calendar row exists to confuse the count.
    expect(repository.arrivals).toHaveLength(0);
  });

  test("still improvises when the booked visit has already been started", async () => {
    // A rep who walks back into the same clinic in the afternoon means the
    // second visit, not a correction to the first.
    const repository = new FakeInteractionRepository();
    repository.plannedVisit = null;

    const result = await arrive(repository);

    expect(repository.arrivals).toHaveLength(1);
    expect(result.status).toBe("IN_PROGRESS");
  });

  test("anchors the calendar row on the rep's wall clock, not the server's", async () => {
    // 12:00Z is 09:00 in São Paulo. Storing the UTC hour would put the visit
    // three hours from where the rep was standing.
    const repository = new FakeInteractionRepository();

    await arrive(repository);

    expect(repository.arrivals[0]?.anchorLocalDate).toBe("2026-08-03");
    expect(repository.arrivals[0]?.anchorLocalTime).toBe("09:00");
    expect(repository.arrivals[0]?.recurrenceKey).toBe("2026-08-03T09:00[America/Sao_Paulo]");
  });

  test("replays instead of recording a second arrival", async () => {
    // A retry on a flaky connection must not produce two visits to the same
    // clinic a second apart.
    const repository = new FakeInteractionRepository();

    await arrive(repository);
    await arrive(repository);

    expect(repository.arrivals).toHaveLength(1);
  });

  test("refuses a clinic outside the rep's scope", async () => {
    const repository = new FakeInteractionRepository();

    await expect(arrive(repository, "REP", scope({ facilityIds: [2] }))).rejects.toThrow();
    expect(repository.arrivals).toHaveLength(0);
  });

  test("refuses a clinic that does not exist rather than failing on the key", async () => {
    const repository = new FakeInteractionRepository();
    repository.facility = null;

    await expect(arrive(repository)).rejects.toThrow();
  });

  test("a manager has no agenda of their own to record against", async () => {
    const repository = new FakeInteractionRepository();

    await expect(arrive(repository, "MANAGER")).rejects.toThrow();
    expect(repository.arrivals).toHaveLength(0);
  });
});
