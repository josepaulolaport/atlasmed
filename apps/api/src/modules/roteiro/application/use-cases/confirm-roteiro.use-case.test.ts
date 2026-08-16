import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ConfirmRoteiroUseCase, type CalendarEventCreator } from "./confirm-roteiro.use-case";
import type {
  ObservedServiceMinutes,
  RepWorkingHours,
  RoteiroRejectionReason,
  RoteiroRepository,
  StoredRoteiro,
  StoredRoteiroStop,
} from "../interfaces/roteiro.repository.interface";

const scope = { isGlobal: false, facilityIds: [], managedUserIds: [] } as unknown as ScopeContext;

function stop(overrides: Partial<StoredRoteiroStop> & { position: number }): StoredRoteiroStop {
  return {
    facilityVerticalProfileId: 100 + overrides.position,
    facilityId: 200 + overrides.position,
    facilityName: `Clinica ${overrides.position}`,
    bucket: "PROSPECTAR",
    modality: "IN_PERSON",
    serviceMinutes: 45,
    travelSecondsFromPrev: 600,
    plannedStartsAt: new Date("2026-08-17T11:00:00Z"),
    plannedEndsAt: new Date("2026-08-17T11:45:00Z"),
    isCoverageSlot: false,
    source: "SUGGESTED",
    meritScore: 0.7,
    scoreBreakdown: {},
    calendarId: null,
    interactionId: null,
    ...overrides,
  };
}

function roteiro(overrides: Partial<StoredRoteiro> = {}): StoredRoteiro {
  return {
    id: 1,
    userId: 7,
    createdByUserId: 7,
    verticalId: 1,
    scopeDate: "2026-08-17",
    status: "DRAFT",
    reachMode: "LIVRE",
    reachBoundKm: 60,
    travelSource: "ESTIMATED",
    anchorProfileId: null,
    version: 1,
    notices: [],
    stops: [stop({ position: 0 }), stop({ position: 1 })],
    ...overrides,
  };
}

class FakeRepository implements RoteiroRepository {
  /** §15.2 / P5 — empty by default, so tests exercise the guessed defaults. */
  observedServiceMinutes: ObservedServiceMinutes[] = [];
  async findObservedServiceMinutes(): Promise<ObservedServiceMinutes[]> {
    return this.observedServiceMinutes;
  }

  /** §15.5.5 — unset by default, so tests exercise the linha fallback. */
  workingHours: RepWorkingHours = {
    workdayStart: null,
    workdayEnd: null,
  };
  async findWorkingHours(): Promise<RepWorkingHours> {
    return this.workingHours;
  }

  /** §15.5.2 — what the rep has thrown away, in the order they threw it. */
  rejections: {
    id: number;
    userId: number;
    facilityVerticalProfileId: number;
    reason: RoteiroRejectionReason | null;
  }[] = [];
  async recordRejection(input: {
    userId: number;
    facilityVerticalProfileId: number;
  }): Promise<{ id: number; priorCount: number }> {
    const priorCount = this.rejections.filter(
      (r) =>
        r.userId === input.userId &&
        r.facilityVerticalProfileId === input.facilityVerticalProfileId,
    ).length;
    const id = this.rejections.length + 1;
    this.rejections.push({ ...input, id, reason: null });
    return { id, priorCount };
  }
  async setRejectionReason(input: {
    rejectionId: number;
    userId: number;
    reason: RoteiroRejectionReason;
  }): Promise<void> {
    const row = this.rejections.find(
      (r) => r.id === input.rejectionId && r.userId === input.userId,
    );
    if (row) row.reason = input.reason;
  }

  links: Array<{ position: number; calendarId: number; interactionId: number }> = [];
  confirmedAt: Date | null = null;
  constructor(private current: StoredRoteiro | null) {}

  async findById() {
    return this.current;
  }
  async linkStop(input: { position: number; calendarId: number; interactionId: number }) {
    this.links.push({
      position: input.position,
      calendarId: input.calendarId,
      interactionId: input.interactionId,
    });
    if (this.current) {
      this.current = {
        ...this.current,
        stops: this.current.stops.map((s) =>
          s.position === input.position
            ? { ...s, calendarId: input.calendarId, interactionId: input.interactionId }
            : s,
        ),
      };
    }
  }
  async markConfirmed(input: { confirmedAt: Date }) {
    this.confirmedAt = input.confirmedAt;
    if (this.current) this.current = { ...this.current, status: "CONFIRMED" };
  }
  async findParams() {
    return null;
  }
  async scoreCandidates() {
    return [];
  }
  async countAssignedProfiles() {
    return 0;
  }
  async searchAddableClinics() {
    return [];
  }
  async locateFacilities() {
    return [];
  }
  async createDraft(): Promise<never> {
    throw new Error("not used");
  }
}

class FakeCalendar implements CalendarEventCreator {
  calls: Array<{ idempotencyKey: string; facilityId: number; durationMinutes: number }> = [];
  constructor(private readonly failOn?: { position: number; error: Error }) {}
  async execute(input: Parameters<CalendarEventCreator["execute"]>[0]) {
    this.calls.push({
      idempotencyKey: input.idempotencyKey,
      facilityId: input.data.facilityId,
      durationMinutes: input.data.durationMinutes,
    });
    if (this.failOn && input.idempotencyKey.endsWith(`:${this.failOn.position}`)) {
      throw this.failOn.error;
    }
    const n = this.calls.length;
    return { id: 1000 + n, interactions: [{ id: 2000 + n }] };
  }
}

const actor = { userId: 7, roleName: "REP" };

describe("ConfirmRoteiroUseCase", () => {
  it("creates one calendar event and interaction per stop", async () => {
    const repository = new FakeRepository(roteiro());
    const calendar = new FakeCalendar();
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar });

    const result = await useCase.execute({ roteiroId: 1, actor, scope });

    expect(calendar.calls).toHaveLength(2);
    expect(repository.links).toHaveLength(2);
    expect(result.status).toBe("CONFIRMED");
  });

  it("passes the stop's own duration and facility to the calendar", async () => {
    const repository = new FakeRepository(
      roteiro({ stops: [stop({ position: 0, serviceMinutes: 15, modality: "REMOTE" })] }),
    );
    const calendar = new FakeCalendar();
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar });

    await useCase.execute({ roteiroId: 1, actor, scope });

    expect(calendar.calls[0]?.durationMinutes).toBe(15);
    expect(calendar.calls[0]?.facilityId).toBe(200);
  });

  it("stamps coverage on confirm, which is what makes the rotation turn", async () => {
    const repository = new FakeRepository(roteiro());
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar: new FakeCalendar() });

    await useCase.execute({ roteiroId: 1, actor, scope, now: new Date("2026-08-17T12:00:00Z") });

    expect(repository.confirmedAt).toEqual(new Date("2026-08-17T12:00:00Z"));
  });

  it("uses an idempotency key that is stable across retries", async () => {
    const repository = new FakeRepository(roteiro());
    const calendar = new FakeCalendar();
    await new ConfirmRoteiroUseCase({ repository, calendar }).execute({
      roteiroId: 1,
      actor,
      scope,
    });

    // The version is deliberately absent: bumping it on confirm would make a
    // retry look like a new command and duplicate the calendar entry.
    expect(calendar.calls.map((c) => c.idempotencyKey)).toEqual([
      "roteiro:1:stop:0",
      "roteiro:1:stop:1",
    ]);
  });

  it("skips stops already linked, so a retry after a conflict does not duplicate", async () => {
    const repository = new FakeRepository(
      roteiro({
        stops: [
          stop({ position: 0, calendarId: 900, interactionId: 901 }),
          stop({ position: 1 }),
        ],
      }),
    );
    const calendar = new FakeCalendar();
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar });

    await useCase.execute({ roteiroId: 1, actor, scope });

    expect(calendar.calls).toHaveLength(1);
    expect(calendar.calls[0]?.idempotencyKey).toBe("roteiro:1:stop:1");
  });

  it("propagates a calendar conflict instead of shifting the rep's times", async () => {
    const repository = new FakeRepository(roteiro());
    const calendar = new FakeCalendar({ position: 1, error: new Error("CalendarConflict") });
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar });

    await expect(useCase.execute({ roteiroId: 1, actor, scope })).rejects.toThrow(
      "CalendarConflict",
    );
    // Stop 0 landed and stays linked; a retry resumes from stop 1.
    expect(repository.links.map((l) => l.position)).toEqual([0]);
    expect(repository.confirmedAt).toBeNull();
  });

  it("returns an already-confirmed roteiro without creating anything again", async () => {
    const repository = new FakeRepository(roteiro({ status: "CONFIRMED" }));
    const calendar = new FakeCalendar();
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar });

    const result = await useCase.execute({ roteiroId: 1, actor, scope });

    expect(calendar.calls).toHaveLength(0);
    expect(result.status).toBe("CONFIRMED");
  });

  it("refuses to confirm a discarded roteiro", async () => {
    const repository = new FakeRepository(roteiro({ status: "DISCARDED" }));
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar: new FakeCalendar() });

    await expect(useCase.execute({ roteiroId: 1, actor, scope })).rejects.toThrow(/DISCARDED/);
  });

  it("refuses to let a manager confirm their rep's roteiro", async () => {
    // Manager proposes, rep accepts (§7.3) — confirming writes to someone
    // else's calendar, which nothing else in the system permits either.
    const repository = new FakeRepository(roteiro({ userId: 7, createdByUserId: 3 }));
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar: new FakeCalendar() });

    await expect(
      useCase.execute({
        roteiroId: 1,
        actor: { userId: 3, roleName: "MANAGER" },
        scope: { ...scope, managedUserIds: [7] } as ScopeContext,
      }),
    ).rejects.toThrow(/own roteiro/);
  });

  it("404s on a roteiro that does not exist", async () => {
    const repository = new FakeRepository(null);
    const useCase = new ConfirmRoteiroUseCase({ repository, calendar: new FakeCalendar() });

    await expect(useCase.execute({ roteiroId: 999, actor, scope })).rejects.toThrow();
  });
});
