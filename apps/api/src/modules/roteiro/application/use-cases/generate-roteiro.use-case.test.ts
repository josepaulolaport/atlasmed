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
    funnelStage: "NEVER_PURCHASED",
    bucket: "PROSPECTAR",
    lat: SAO_PAULO.lat + id * 0.01,
    lng: SAO_PAULO.lng,
    straightLineKm: id,
    orthopaedistCount: 10,
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
      anchor?: { facilityId: number; facilityName: string; lat: number; lng: number } | null;
      /** Return nothing until the bound reaches this value — exercises expansion. */
      minBoundKm?: number;
    } = {},
  ) {}

  async findParams() {
    return this.options.params ?? null;
  }
  async countAssignedProfiles() {
    return this.options.assigned ?? 100;
  }
  async findAnchorProfile() {
    return this.options.anchor ?? null;
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
    const overdue = byMerit
      .filter((c) => c.coverageOverdue && !top.includes(c))
      .sort((a, b) => {
        const at = a.lastSuggestedAt?.getTime() ?? -Infinity;
        const bt = b.lastSuggestedAt?.getTime() ?? -Infinity;
        return at - bt;
      })
      .slice(0, 5);
    return [...top, ...overdue];
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

  it("says when it fell back to default params instead of pretending they were configured", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.notices.map((n) => n.code)).toContain("PARAMS_DEFAULTED");
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

  it("plans in LIVRE mode with no anchor", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.reachMode).toBe("LIVRE");
    expect(result.anchorProfileId).toBeNull();
    expect(repository.calls[0]?.anchor).toBeNull();
  });

  it("puts an agreed visit first and plans the rest around it", async () => {
    const anchorCandidate = candidate({ id: 42, facilityName: "Ja combinada", meritScore: 0.01 });
    const repository = new FakeRepository(
      [anchorCandidate, ...Array.from({ length: 10 }, (_, i) => candidate({ id: i + 1 }))],
      { anchor: { facilityId: 42, facilityName: "Ja combinada", lat: -23.6, lng: -46.7 } },
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput({ anchorProfileId: 42 }));

    expect(result.reachMode).toBe("ANCORA");
    expect(result.stops[0]?.candidate.facilityName).toBe("Ja combinada");
    expect(result.stops[0]?.isAnchor).toBe(true);
    expect(repository.calls[0]?.anchor).toEqual({ lat: -23.6, lng: -46.7 });
  });

  it("rejects an anchor that is not the subject's clinic", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })], { anchor: null });
    const useCase = new GenerateRoteiroUseCase({ repository });

    await expect(useCase.execute(baseInput({ anchorProfileId: 999 }))).rejects.toThrow();
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

  it("marks travel as estimated — P1 has no Matrix call", async () => {
    const repository = new FakeRepository([candidate({ id: 1 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.travelSource).toBe("ESTIMATED");
  });

  it("gives a remote-forced unit type no travel time at all", async () => {
    const params: RoteiroParams = {
      verticalId: 1,
      ...DEFAULT_ROTEIRO_PARAMS,
      unitTypePolicy: {
        ...DEFAULT_ROTEIRO_PARAMS.unitTypePolicy,
        "Consultorio Isolado": { fit: 0.35, eligible: true, forceRemote: true },
      },
    };
    const repository = new FakeRepository(
      [candidate({ id: 1, unitType: "Consultorio Isolado" })],
      { params },
    );
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.stops[0]?.modality).toBe("REMOTE");
    expect(result.stops[0]?.travelSecondsFromPrev).toBeNull();
    expect(result.totals.driveSeconds).toBe(0);
  });

  it("reports a short slate instead of quietly returning fewer clinics", async () => {
    const repository = new FakeRepository([candidate({ id: 1 }), candidate({ id: 2 })]);
    const useCase = new GenerateRoteiroUseCase({ repository });

    const result = await useCase.execute(baseInput());

    expect(result.stops).toHaveLength(2);
    const short = result.notices.find((n) => n.code === "SHORT_SLATE");
    expect(short).toBeDefined();
    expect(short?.filled).toBe(2);
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
