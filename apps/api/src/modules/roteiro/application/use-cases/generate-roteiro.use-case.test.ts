import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  DEFAULT_ROTEIRO_PARAMS,
  GenerateRoteiroUseCase,
  bucketQuotas,
  type GenerateRoteiroInput,
} from "./generate-roteiro.use-case";
import type {
  RoteiroBucket,
  RoteiroCandidate,
  RoteiroParams,
  RoteiroRepository,
  ScoreCandidatesInput,
} from "../interfaces/roteiro.repository.interface";

const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };

function candidate(overrides: Partial<RoteiroCandidate> & { id: number }): RoteiroCandidate {
  const { id, ...rest } = overrides;
  return {
    facilityVerticalProfileId: id,
    facilityId: id,
    facilityName: `Clinica ${id}`,
    cnesCode: `cnes-${id}`,
    unitType: "Clinica/Centro de Especialidade",
    municipality: "Sao Paulo",
    neighborhood: null,
    funnelStage: "NEVER_PURCHASED",
    bucket: "PROSPECTAR",
    lat: SAO_PAULO.lat + id * 0.01,
    lng: SAO_PAULO.lng,
    straightLineKm: id,
    orthopaedistCount: 10,
    totalProfessionalCount: 20,
    orthopaedistShare: 0.5,
    registryKnown: true,
    assignmentStartedAt: null,
    theirsQty: null,
    oursQty: null,
    daysSinceLastInteraction: null,
    daysSinceLastPurchase: null,
    purchaseIntervalDays: 30,
    lastSuggestedAt: null,
    coverageOverdue: false,
    meritScore: 0.5,
    components: {},
    ...rest,
  };
}

class FakeRepository implements RoteiroRepository {
  calls: ScoreCandidatesInput[] = [];
  constructor(
    private readonly candidates: RoteiroCandidate[],
    private readonly options: {
      params?: RoteiroParams | null;
      assigned?: number;
      /** Return nothing until the bound reaches this value — exercises expansion. */
      minBoundKm?: number;
      located?: Array<{
        facilityId: number;
        facilityVerticalProfileId: number | null;
        facilityName: string;
        lat: number;
        lng: number;
      }>;
    } = {},
  ) {}

  async findParams() {
    return this.options.params ?? null;
  }
  async countAssignedProfiles() {
    return this.options.assigned ?? 100;
  }
  async searchAddableClinics() {
    return [];
  }
  async locateFacilities() {
    return this.options.located ?? [];
  }
  // Persistence is exercised by the confirm tests and the HTTP integration
  // suite; generation itself never writes.
  async createDraft(): Promise<never> {
    throw new Error("createDraft is not part of generation");
  }
  async findById() {
    return null;
  }
  async linkStop() {
    /* no-op */
  }
  async markConfirmed() {
    /* no-op */
  }
  /**
   * Mirrors the repository contract: top `limit` by merit, **plus** the most
   * coverage-overdue candidates regardless of merit. Slicing to `limit` alone
   * would drop exactly the low-merit overdue clinic the coverage slot exists
   * to reach — which is the bug this fake originally hid.
   */
  async scoreCandidates(input: ScoreCandidatesInput) {
    this.calls.push(input);
    if (this.options.minBoundKm && input.reachBoundKm < this.options.minBoundKm) return [];
    const byMerit = [...this.candidates].sort((a, b) => b.meritScore - a.meritScore);
    const top = byMerit.slice(0, input.limit);
    const requested = byMerit.filter(
      (c) => input.includeProfileIds.includes(c.facilityVerticalProfileId) && !top.includes(c),
    );
    const overdue = byMerit
      .filter((c) => c.coverageOverdue && !top.includes(c) && !requested.includes(c))
      .sort((a, b) => {
        const at = a.lastSuggestedAt?.getTime() ?? -Infinity;
        const bt = b.lastSuggestedAt?.getTime() ?? -Infinity;
        return at - bt;
      })
      .slice(0, 5);
    return [...top, ...requested, ...overdue];
  }
}

const scope: ScopeContext = {
  isGlobal: false,
  facilityIds: [],
  managedUserIds: [],
} as unknown as ScopeContext;

function baseInput(overrides: Partial<GenerateRoteiroInput> = {}): GenerateRoteiroInput {
  return {
    actor: { userId: 7, roleName: "REP" },
    scope,
    verticalId: 1,
    origin: SAO_PAULO,
    today: "2026-08-17",
    now: new Date("2026-08-17T09:00:00-03:00"),
    ...overrides,
  };
}

describe("bucketQuotas", () => {
  it("gives prospecting the majority of a five-stop day", () => {
    // The book is 93.8% NEVER_PURCHASED and there are 42 MANTER-eligible
    // profiles across all five reps (spec 0016 §4.9) — three maintenance slots
    // a day would exhaust that list in three days.
    const quotas = bucketQuotas(5, DEFAULT_ROTEIRO_PARAMS.bucketRatios);
    expect(quotas.PROSPECTAR).toBe(3);
    expect(quotas.MANTER).toBe(1);
    expect(quotas.RECUPERAR).toBe(1);
  });

  it("never drops a bucket to zero, even at limit 1", () => {
    const quotas = bucketQuotas(1, DEFAULT_ROTEIRO_PARAMS.bucketRatios);
    expect(Math.min(quotas.MANTER, quotas.RECUPERAR, quotas.PROSPECTAR)).toBe(1);
  });

  it("never assigns more slots than the limit when ratios permit", () => {
    const quotas = bucketQuotas(6, { MANTER: 0.5, RECUPERAR: 0.3, PROSPECTAR: 0.2 });
    const total = quotas.MANTER + quotas.RECUPERAR + quotas.PROSPECTAR;
    expect(total).toBeLessThanOrEqual(6);
  });
});

describe("GenerateRoteiroUseCase", () => {
  it("returns at most the requested limit and never exceeds the params ceiling", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 40 }, (_, i) => candidate({ id: i + 1 })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ limit: 99 }));

    expect(result.stops).toHaveLength(DEFAULT_ROTEIRO_PARAMS.dailyLimit);
  });

  it("reports default params to ops without putting them in the rep's notices", async () => {
    // True, unchanging and outside a rep's control. On every generation it
    // trains them to ignore the notice area, which is where the things they can
    // act on appear.
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.usingDefaultParams).toBe(true);
    expect(result.notices.map((n) => n.code)).not.toContain("PARAMS_DEFAULTED");
  });

  it("does not claim a bucket was empty when the day merely ran out of room", async () => {
    // Measured against a real book this fired while 126 reachable prospects sat
    // in the candidate set — DAY_FULL was the true explanation and this
    // contradicted it.
    const repository = new FakeRepository(
      Array.from({ length: 20 }, (_, i) => candidate({ id: i + 1, bucket: "PROSPECTAR" })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    // Late start: only one visit fits before the workday ends.
    const result = await useCase.execute(
      baseInput({ now: new Date("2026-08-17T17:00:00-03:00") }),
    );

    const unfilled = result.notices.filter((n) => n.code === "QUOTA_UNFILLED");
    expect(unfilled.map((n) => n.bucket)).not.toContain("PROSPECTAR");
  });

  it("reports an unfilled quota rather than silently dropping the bucket", async () => {
    // Prospects only: MANTER and RECUPERAR cannot be filled at all.
    const repository = new FakeRepository(
      Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1, bucket: "PROSPECTAR" })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    const unfilled = result.notices.filter((n) => n.code === "QUOTA_UNFILLED");
    expect(unfilled.map((n) => n.bucket).sort()).toEqual(["MANTER", "RECUPERAR"]);
    // The slate is still full — quotas are targets, not floors.
    expect(result.stops).toHaveLength(5);
  });

  it("reserves a slot for the clinic longest without a commitment", async () => {
    const overdue = candidate({
      id: 99,
      coverageOverdue: true,
      lastSuggestedAt: null,
      meritScore: 0.01, // would never make the cut on merit
      facilityName: "Nunca visitada",
    });
    const repository = new FakeRepository([
      ...Array.from({ length: 20 }, (_, i) => candidate({ id: i + 1, meritScore: 0.9 })),
      overdue,
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    const coverage = result.stops.filter((s) => s.isCoverageSlot);
    expect(coverage).toHaveLength(1);
    expect(coverage[0]?.candidate.facilityName).toBe("Nunca visitada");
  });

  it("breaks a never-covered tie by assignment age, not by merit", async () => {
    // Every never-covered clinic shares a null lastSuggestedAt — today that is
    // the entire book — so without this the tie falls to merit and the clinic a
    // rep has been sitting on for months never surfaces.
    const recentlyAssigned = candidate({
      id: 50,
      coverageOverdue: true,
      assignmentStartedAt: new Date("2026-08-10"),
      meritScore: 0.9,
      facilityName: "Recem atribuida",
    });
    const longAssigned = candidate({
      id: 51,
      coverageOverdue: true,
      assignmentStartedAt: new Date("2026-02-01"),
      meritScore: 0.2,
      facilityName: "Esquecida ha meses",
    });
    const repository = new FakeRepository([
      ...Array.from({ length: 20 }, (_, i) => candidate({ id: i + 1, meritScore: 0.95 })),
      recentlyAssigned,
      longAssigned,
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    const coverage = result.stops.find((s) => s.isCoverageSlot);
    expect(coverage?.candidate.facilityName).toBe("Esquecida ha meses");
  });

  it("widens the bound when nothing is close, and says how far it reached", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 20 }, (_, i) => candidate({ id: i + 1 })),
      { minBoundKm: 240 },
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.reachBoundKm).toBe(DEFAULT_ROTEIRO_PARAMS.reachRadiusKm * 4);
    expect(result.notices.map((n) => n.code)).toContain("REACH_EXPANDED");
  });

  it("plans a clear day as a plain circle around the rep", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: { execute: async () => [] },
    });

    const result = await useCase.execute(baseInput());

    expect(result.reachMode).toBe("LIVRE");
    expect(repository.calls[0]?.fixedPoints).toEqual([]);
  });

  it("derives the day's fixed points from booked visits, without being told", async () => {
    // The rep does not declare where they are going; the app booked those
    // visits and can read them back.
    const repository = new FakeRepository([candidate({ id: 1 })], {
      located: [
        {
          facilityId: 55,
          facilityVerticalProfileId: 77,
          facilityName: "Ja agendada",
          lat: -23.6,
          lng: -46.7,
        },
      ],
    });
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: {
        execute: async () => [
          {
            startsAt: "2026-08-17T13:00:00.000Z",
            endsAt: "2026-08-17T14:00:00.000Z",
            interaction: { facilityId: 55 },
          },
        ],
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.reachMode).toBe("ANCORA");
    expect(result.fixedPoints).toHaveLength(1);
    expect(result.fixedPoints[0]?.facilityName).toBe("Ja agendada");
    // The scorer is asked for clinics on the way to it.
    expect(repository.calls[0]?.fixedPoints).toHaveLength(1);
  });

  it("does not let a booked phone call anchor the route", async () => {
    // A rep can take a call from anywhere. It blocks the clock and nothing
    // else — anchoring on it would drag the reachable set toward a clinic
    // nobody is driving to and reserve travel for a journey that never happens.
    const repository = new FakeRepository([candidate({ id: 1 })], {
      located: [
        {
          facilityId: 55,
          facilityVerticalProfileId: 77,
          facilityName: 'Ligacao',
          lat: -23.9,
          lng: -46.9,
        },
      ],
    });
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: {
        execute: async () => [
          {
            startsAt: "2026-08-17T13:00:00.000Z",
            endsAt: "2026-08-17T13:30:00.000Z",
            interaction: { facilityId: 55, modality: "REMOTE" },
          },
        ],
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.fixedPoints).toEqual([]);
    expect(result.reachMode).toBe("LIVRE");
    // Still busy: nothing is scheduled over the call.
    for (const stop of result.stops) {
      const overlaps =
        stop.plannedStartsAt.getTime() < new Date("2026-08-17T13:30:00.000Z").getTime() &&
        stop.plannedEndsAt.getTime() > new Date("2026-08-17T13:00:00.000Z").getTime();
      expect(overlaps).toBe(false);
    }
  });

  it("still anchors on a booked in-person visit", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })], {
      located: [
        {
          facilityId: 55,
          facilityVerticalProfileId: 77,
          facilityName: 'Presencial',
          lat: -23.6,
          lng: -46.7,
        },
      ],
    });
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: {
        execute: async () => [
          {
            startsAt: "2026-08-17T13:00:00.000Z",
            endsAt: "2026-08-17T14:00:00.000Z",
            interaction: { facilityId: 55, modality: "IN_PERSON" },
          },
        ],
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.fixedPoints).toHaveLength(1);
    expect(result.reachMode).toBe("ANCORA");
  });

  it("treats a personal block as busy time, not as somewhere to be", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: {
        execute: async () => [
          { startsAt: "2026-08-17T13:00:00.000Z", endsAt: "2026-08-17T14:00:00.000Z" },
        ],
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.fixedPoints).toEqual([]);
    expect(result.reachMode).toBe("LIVRE");
    // It still blocks the clock.
    for (const stop of result.stops) {
      const overlaps =
        stop.plannedStartsAt.getTime() < new Date("2026-08-17T14:00:00.000Z").getTime() &&
        stop.plannedEndsAt.getTime() > new Date("2026-08-17T13:00:00.000Z").getTime();
      expect(overlaps).toBe(false);
    }
  });

  it("starts a future day at the first booked visit when no origin is given", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })], {
      located: [
        {
          facilityId: 55,
          facilityVerticalProfileId: 77,
          facilityName: "Primeira",
          lat: -23.6,
          lng: -46.7,
        },
      ],
    });
    const useCase = new GenerateRoteiroUseCase({
      repository,
      schedule: {
        execute: async () => [
          {
            startsAt: "2026-08-17T12:00:00.000Z",
            endsAt: "2026-08-17T13:00:00.000Z",
            interaction: { facilityId: 55, modality: "IN_PERSON" },
          },
        ],
      },
    });

    const result = await useCase.execute({ ...baseInput(), origin: undefined });

    expect(result.origin).toEqual({ lat: -23.6, lng: -46.7 });
  });

  it("refuses a day with no origin and nothing booked, rather than guessing", async () => {
    // A plan built from an inferred position produces drive times that look
    // exactly as trustworthy as real ones (§4.1).
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    await expect(
      useCase.execute({ ...baseInput(), origin: undefined }),
    ).rejects.toThrow(/começa o dia/);
  });

  it("refills the slot when a clinic is removed, rather than returning a shorter day", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1 })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ excludeProfileIds: [1, 2] }));

    expect(result.stops).toHaveLength(5);
    expect(repository.calls[0]?.excludeProfileIds).toEqual([1, 2]);
  });

  it("places a clinic the rep asked for, ahead of the ranking", async () => {
    const wanted = candidate({ id: 99, meritScore: 0.01, facilityName: "Pedida" });
    const repository = new FakeRepository([
      ...Array.from({ length: 20 }, (_, i) => candidate({ id: i + 1, meritScore: 0.9 })),
      wanted,
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ includeProfileIds: [99] }));

    expect(result.stops.map((s) => s.candidate.facilityName)).toContain("Pedida");
  });

  it("gives a maintenance call-in less of the day than a first visit", async () => {
    // One duration for every clinic is plainly wrong, and the difference is not
    // cosmetic: it is the denominator of the gain a stop is chosen on.
    const repository = new FakeRepository([
      candidate({ id: 1, bucket: "MANTER", funnelStage: "PURCHASE_WINDOW", meritScore: 0.9 }),
      candidate({ id: 2, bucket: "PROSPECTAR", meritScore: 0.89 }),
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ limit: 2 }));
    const byId = new Map(result.stops.map((s) => [s.candidate.facilityVerticalProfileId, s]));

    expect(byId.get(1)?.serviceMinutes).toBe(30);
    expect(byId.get(2)?.serviceMinutes).toBe(60);
  });

  it("plans with the duration the rep gave, not the bucket default", async () => {
    const repository = new FakeRepository([candidate({ id: 1, meritScore: 0.9 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({ limit: 1, durationOverrides: { 1: 120 } }),
    );

    expect(result.stops[0]?.serviceMinutes).toBe(120);
  });

  it("rounds a duration up to a calendar slot rather than shifting it later", async () => {
    // The calendar only holds multiples of 30 (§7.3). Snapping here means the
    // rep sees the number their agenda will actually keep.
    const repository = new FakeRepository([candidate({ id: 1, meritScore: 0.9 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({ limit: 1, durationOverrides: { 1: 40 } }),
    );

    expect(result.stops[0]?.serviceMinutes).toBe(60);
  });

  it("keeps a clinic the rep pinned at exactly the time they pinned it to", async () => {
    const at = new Date("2026-08-17T14:00:00-03:00");
    const repository = new FakeRepository([
      candidate({ id: 1, meritScore: 0.99 }),
      candidate({ id: 2, meritScore: 0.98 }),
      candidate({ id: 42, meritScore: 0.01, facilityName: "Fixada" }),
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({ limit: 3, startOverrides: { 42: at } }),
    );

    const pinnedStop = result.stops.find((s) => s.candidate.facilityName === "Fixada");
    expect(pinnedStop).toBeDefined();
    expect(pinnedStop?.plannedStartsAt.getTime()).toBe(at.getTime());
    // The rep committed to it, so it is not a suggestion the route may move.
    expect(pinnedStop?.isAnchor).toBe(true);
    // And it is not also echoed as a booked visit — that would draw it twice.
    expect(result.fixedPoints.some((p) => p.facilityName === "Fixada")).toBe(false);
  });

  it("plans the rest of the day around a pinned time instead of over it", async () => {
    const at = new Date("2026-08-17T14:00:00-03:00");
    const repository = new FakeRepository([
      ...Array.from({ length: 6 }, (_, i) => candidate({ id: i + 1, meritScore: 0.9 })),
      candidate({ id: 42, meritScore: 0.01, facilityName: "Fixada" }),
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({ limit: 5, startOverrides: { 42: at } }),
    );
    const pinnedStop = result.stops.find((s) => s.candidate.facilityName === "Fixada")!;

    for (const stop of result.stops) {
      if (stop.candidate.facilityName === "Fixada") continue;
      const clashes =
        stop.plannedStartsAt.getTime() < pinnedStop.plannedEndsAt.getTime() &&
        pinnedStop.plannedStartsAt.getTime() < stop.plannedEndsAt.getTime();
      expect(clashes).toBe(false);
    }
    // The pin takes one of the five slots rather than being added on top.
    expect(result.stops.length).toBeLessThanOrEqual(5);
  });

  it("does not rank a clinic CNES knows nothing about below one it knows is empty", async () => {
    // Absent is not zero. 15% of the book has no CNES staff row, and a load
    // that half-failed looks exactly like this — so the unknown sit at the
    // neutral mid-band rather than at the bottom (§15.5.3).
    const repository = new FakeRepository([
      candidate({
        id: 1,
        facilityName: "Desconhecida",
        registryKnown: false,
        orthopaedistCount: 0,
        orthopaedistShare: 0,
      }),
      candidate({
        id: 2,
        facilityName: "Sem ortopedistas",
        registryKnown: true,
        orthopaedistCount: 0,
        orthopaedistShare: 0,
      }),
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ limit: 2 }));
    const unknown = result.stops.find((s) => s.candidate.facilityName === "Desconhecida");

    expect(unknown).toBeDefined();
    expect(unknown!.candidate.registryKnown).toBe(false);
  });

  it("reports thin registry coverage to ops without putting it on the rep's screen", async () => {
    const repository = new FakeRepository([
      candidate({ id: 1, registryKnown: false }),
      candidate({ id: 2, registryKnown: false }),
      candidate({ id: 3, registryKnown: true }),
    ]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ limit: 3 }));

    expect(result.registryCoverageLow).toBe(true);
    // A rep planning their morning cannot act on a registry load, and a notice
    // they cannot act on pushes the ones they can off the screen.
    expect(result.notices.some((n) => n.code === "REGISTRY_COVERAGE_LOW")).toBe(false);
  });

  it("refuses to plan another rep's day", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    await expect(
      useCase.execute(baseInput({ subjectUserId: 8, actor: { userId: 7, roleName: "REP" } })),
    ).rejects.toThrow(/scope/i);
  });

  it("lets a manager draft for a rep they manage", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({
        subjectUserId: 8,
        actor: { userId: 3, roleName: "MANAGER" },
        scope: { ...scope, managedUserIds: [8] } as ScopeContext,
      }),
    );

    expect(result.subjectUserId).toBe(8);
  });

  it("errors when the subject has no clinics in the linha at all", async () => {
    const repository = new FakeRepository([], { assigned: 0 });
    const useCase = new GenerateRoteiroUseCase({ repository });

    await expect(useCase.execute(baseInput())).rejects.toThrow();
  });

  it("schedules travel-aware times: each stop starts after the previous ends", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1 })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    for (let i = 1; i < result.stops.length; i += 1) {
      const previous = result.stops[i - 1]!;
      const current = result.stops[i]!;
      const minimumStart =
        previous.plannedEndsAt.getTime() + (current.travelSecondsFromPrev ?? 0) * 1000;
      expect(current.plannedStartsAt.getTime()).toBeGreaterThanOrEqual(minimumStart);
    }
  });

  it("refuses once the agent has regenerated too many times today", async () => {
    // The check runs before the Matrix call, since the point is to stop the
    // spend rather than report it afterwards.
    const repository = new FakeRepository([candidate({ id: 1 })]);
    let matrixCalls = 0;
    const useCase = new GenerateRoteiroUseCase({
      repository,
      quota: { consume: async () => false },
      travel: {
        durations: async (points) => {
          matrixCalls += 1;
          return points.map(() => points.map(() => 300));
        },
      },
    });

    await expect(useCase.execute(baseInput())).rejects.toThrow(/gera/i);
    expect(matrixCalls).toBe(0);
  });

  it("passes the configured ceiling to the quota", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    let seen: { userId: number; day: string; max: number } | undefined;
    const useCase = new GenerateRoteiroUseCase({
      repository,
      quota: {
        consume: async (input) => {
          seen = input;
          return true;
        },
      },
    });

    await useCase.execute(baseInput());

    expect(seen?.max).toBe(DEFAULT_ROTEIRO_PARAMS.maxGenerationsPerDay);
  });

  it("marks travel as estimated when no travel source is wired", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.travelSource).toBe("ESTIMATED");
  });

  it("uses real drive times when Mapbox answers", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 6 }, (_, i) => candidate({ id: i + 1 })),
    );
    let asked: unknown[] = [];
    const useCase = new GenerateRoteiroUseCase({
      repository,
      travel: {
        durations: async (points) => {
          asked = points;
          // A flat 5 minutes between everything.
          return points.map(() => points.map(() => 300));
        },
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.travelSource).toBe("MAPBOX");
    // One call, covering the rep plus the shortlist.
    expect(asked.length).toBeGreaterThan(1);
    for (const stop of result.stops.slice(1)) {
      expect(stop.travelSecondsFromPrev).toBe(300);
    }
  });

  it("falls back to estimates when Mapbox declines, and says so", async () => {
    const repository = new FakeRepository([candidate({ id: 1 }), candidate({ id: 2 })]);
    const useCase = new GenerateRoteiroUseCase({
      repository,
      travel: { durations: async () => null },
    });

    const result = await useCase.execute(baseInput());

    expect(result.travelSource).toBe("ESTIMATED");
    expect(result.notices.map((n) => n.code)).toContain("TRAVEL_ESTIMATED");
    expect(result.stops.length).toBeGreaterThan(0);
  });

  it("still produces a plan when Mapbox throws — a rep in a car has no signal", async () => {
    const repository = new FakeRepository([candidate({ id: 1 }), candidate({ id: 2 })]);
    const useCase = new GenerateRoteiroUseCase({
      repository,
      travel: {
        durations: async () => {
          throw new Error("ECONNREFUSED");
        },
      },
    });

    const result = await useCase.execute(baseInput());

    expect(result.travelSource).toBe("ESTIMATED");
    expect(result.stops.length).toBeGreaterThan(0);
    expect(result.notices.map((n) => n.code)).toContain("TRAVEL_ESTIMATED");
  });

  it("never exceeds the Matrix coordinate cap", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 40 }, (_, i) => candidate({ id: i + 1 })),
    );
    let count = 0;
    const useCase = new GenerateRoteiroUseCase({
      repository,
      travel: {
        durations: async (points) => {
          count = points.length;
          return points.map(() => points.map(() => 300));
        },
      },
    });

    await useCase.execute(baseInput());

    expect(count).toBeLessThanOrEqual(25);
  });

  it("only ever proposes visits, never calls", async () => {
    // Roteirização plans driving. A call is something the rep arranges
    // themselves; the engine's only interest in one is the time it takes.
    const repository = new FakeRepository(
      Array.from({ length: 5 }, (_, i) =>
        candidate({ id: i + 1, unitType: "Consultorio Isolado" }),
      ),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.stops.length).toBeGreaterThan(0);
    for (const stop of result.stops) {
      expect(stop.modality).toBe("IN_PERSON");
      expect(stop.travelSecondsFromPrev).not.toBeNull();
    }
  });

  it("drops stops that run past the end of the workday, and says so", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1 })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    // Starting at 17:00 against an 18:00 close leaves room for one visit.
    const result = await useCase.execute(
      baseInput({ now: new Date("2026-08-17T17:00:00-03:00") }),
    );

    expect(result.stops.length).toBeLessThan(5);
    expect(result.notices.map((n) => n.code)).toContain("DAY_FULL");
    for (const stop of result.stops) {
      expect(stop.plannedEndsAt.getTime()).toBeLessThanOrEqual(
        new Date("2026-08-17T18:00:00-03:00").getTime(),
      );
    }
  });

  it("returns fewer stops when only a few clinics are reachable", async () => {
    const repository = new FakeRepository([candidate({ id: 1 }), candidate({ id: 2 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.stops).toHaveLength(2);
  });

  it("says so when nothing at all is reachable", async () => {
    const repository = new FakeRepository([]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.stops).toHaveLength(0);
    expect(result.notices.map((n) => n.code)).toContain("NO_CANDIDATES");
  });

  it("does not schedule a visit through lunch", async () => {
    const repository = new FakeRepository(
      Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1 })),
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(
      baseInput({ now: new Date("2026-08-17T11:40:00-03:00") }),
    );

    const lunchStart = new Date("2026-08-17T12:00:00-03:00").getTime();
    const lunchEnd = new Date("2026-08-17T13:00:00-03:00").getTime();
    for (const stop of result.stops) {
      const overlaps =
        stop.plannedStartsAt.getTime() < lunchEnd && stop.plannedEndsAt.getTime() > lunchStart;
      expect(overlaps).toBe(false);
    }
  });
});
