import { describe, expect, it } from "bun:test";
import { Role, createEmptyScopeContext, withTerritoryScopeAliases } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { DashboardDirectoryPort } from "../dashboard-query";
import type {
  DashboardProfileFilter,
  DashboardSubject,
} from "../dashboard-query";
import {
  GetAssignedClinicsMetricUseCase,
  GetCadastroCompletionMetricUseCase,
  GetCoverageMetricUseCase,
  GetOrdersMetricUseCase,
  GetPenetrationMetricUseCase,
  GetUnassignedClinicsMetricUseCase,
  globalTerritoryLabel,
  type DashboardMetricRequest,
} from "./dashboard-metrics.use-cases";

type Repo = ConstructorParameters<
  typeof GetAssignedClinicsMetricUseCase
>[0]["repository"];

/** Records the filter each metric was asked for, so scope can be asserted. */
function fakeRepository(overrides: Partial<Repo> = {}) {
  const seen: DashboardProfileFilter[] = [];
  const repository = {
    countProfiles: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return 10;
    },
    countPurchaseBuckets: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      // 5 have bought at some point (3 in the window, 1 outside it, 1 churned),
      // 5 never have — so Cobertura is 5/10. INACTIVE sits on the "has bought"
      // side, which is the half the old three-bucket grouping got wrong.
      return {
        stages: {
          NEVER_PURCHASED: 5,
          OUTSIDE_WINDOW: 1,
          PURCHASE_WINDOW: 3,
          CHURN: 1,
          INACTIVE: 0,
          UNKNOWN: 0,
        },
        total: 10,
      };
    },
    countRegisteredProfiles: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return { registered: 4, total: 10 };
    },
    countProfilesWithoutRep: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return 6;
    },
    // Deliberately not 10: the two counts partition the scope, and a fake that
    // returned the denominator here would pass the very defect this pair had.
    countProfilesWithRep: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return 4;
    },
    countOrders: async () => ({ week: 2, month: 9 }),
    averageShareByDefinition: async () => [
      {
        definitionId: 1,
        key: "ampolas_mes",
        label: "Ampolas/mês",
        meanShare: 0.5,
        clinicsCounted: 2,
      },
    ],
    listScopedClinics: async () => ({ rows: [], total: 0 }),
    countDoctors: async () => 0,
    listAssignedTerritoryFeatures: async () => [],
    listVerticalTerritoryFeatures: async () => [],
    ...overrides,
  } as unknown as Repo;

  return { repository, seen };
}

function fakeDirectory(
  overrides: Partial<DashboardDirectoryPort> = {},
): DashboardDirectoryPort {
  return {
    findUser: async () => null,
    findManagerZoneIds: async () => [11],
    findManagedUserIds: async () => [],
    ...overrides,
  };
}

function request(
  viewer: DashboardSubject,
  overrides: Partial<DashboardMetricRequest> = {},
): DashboardMetricRequest {
  return {
    viewerId: viewer.userId,
    viewerRole: viewer.roleName,
    scope: withTerritoryScopeAliases({
      ...createEmptyScopeContext(),
      assignedVerticalIds: [1],
      managedUserIds: [],
      isOperationallyActive: true,
    }),
    verticalId: 1,
    subjectUserId: null,
    filters: {},
    ...overrides,
  };
}

const rep: DashboardSubject = { userId: 5, roleName: Role.REP };
const manager: DashboardSubject = { userId: 2, roleName: Role.MANAGER };
const admin: DashboardSubject = { userId: 1, roleName: Role.ADMIN };

describe("dashboard metrics — scope (spec 0014 §3, §7.3)", () => {
  it("measures a rep on the clinics assigned to them", async () => {
    const { repository, seen } = fakeRepository();
    await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(seen[0]).toMatchObject({ repUserIds: [5], zoneIds: null });
  });

  it("measures a manager on the clinics in their zones", async () => {
    const { repository, seen } = fakeRepository();
    await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory({ findManagerZoneIds: async () => [11, 12] }),
    }).execute(request(manager));

    expect(seen[0]).toMatchObject({ zoneIds: [11, 12], repUserIds: null });
  });

  it("scopes to a rep when a manager opens that rep's desempenho (§7.6)", async () => {
    const { repository, seen } = fakeRepository();
    await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory({
        findUser: async () => rep,
        findManagerZoneIds: async () => [11, 12],
      }),
    }).execute(
      request(manager, {
        subjectUserId: 5,
        scope: withTerritoryScopeAliases({
          ...createEmptyScopeContext(),
          assignedVerticalIds: [1],
          managedUserIds: [5],
          isOperationallyActive: true,
        }),
      }),
    );

    // Spec 0015 R2: the manager's own zones ride alongside the rep. This
    // asserted `zoneIds: null` until 0015 — the whole rep, including patches
    // held under another manager. The roster is scoped, so an unscoped
    // dashboard meant tapping a row silently changed the population.
    expect(seen[0]).toMatchObject({ repUserIds: [5], zoneIds: [11, 12] });
  });

  it("leaves an admin the whole rep unless they drilled through a team", async () => {
    const { repository, seen } = fakeRepository();
    await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory({
        findUser: async () => rep,
        findManagerZoneIds: async () => [11, 12],
      }),
    }).execute(request(admin, { subjectUserId: 5 }));

    expect(seen[0]).toMatchObject({ repUserIds: [5], zoneIds: null });
  });

  it("narrows an admin to the team they drilled through (0015 R2)", async () => {
    const { repository, seen } = fakeRepository();
    await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory({
        findUser: async () => rep,
        findManagerZoneIds: async () => [21],
      }),
    }).execute(request(admin, { subjectUserId: 5, withinManagerId: 2 }));

    expect(seen[0]).toMatchObject({ repUserIds: [5], zoneIds: [21] });
  });

  it("answers zero — without querying — when the scope resolves to nothing", async () => {
    const { repository, seen } = fakeRepository();
    const result = await new GetAssignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory({ findManagerZoneIds: async () => [] }),
    }).execute(request(manager));

    expect(result.value).toBe(0);
    expect(seen).toHaveLength(0);
  });
});

describe("cobertura (spec 0014 §4)", () => {
  it("counts clinics that have ever bought over the denominator", async () => {
    const { repository } = fakeRepository();
    const result = await new GetCoverageMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(result.covered).toBe(5);
    expect(result.denominator).toBe(10);
    expect(result.percent).toBe(0.5);
  });

  it("reports no percentage — not 0% — when there are no clinics", async () => {
    const { repository } = fakeRepository({
      countPurchaseBuckets: async () => ({
        stages: {
          NEVER_PURCHASED: 0,
          OUTSIDE_WINDOW: 0,
          PURCHASE_WINDOW: 0,
          CHURN: 0,
          INACTIVE: 0,
          UNKNOWN: 0,
        },
        total: 0,
      }),
    });
    const result = await new GetCoverageMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(result.percent).toBeNull();
  });
});

describe("taxa de cadastro completo", () => {
  it("divides REGISTERED profiles by the denominator", async () => {
    const { repository } = fakeRepository();
    const result = await new GetCadastroCompletionMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(result.registered).toBe(4);
    expect(result.percent).toBe(0.4);
  });
});

describe("pedidos", () => {
  it("returns the trailing week and the current month separately", async () => {
    const { repository } = fakeRepository();
    const result = await new GetOrdersMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute({ ...request(rep), now: new Date("2026-08-11T12:00:00Z") });

    expect(result).toMatchObject({ week: 2, month: 9 });
  });
});

describe("penetração média (spec 0014 §7.4)", () => {
  it("reports the mean beside how many clinics it was calculated from", async () => {
    const { repository } = fakeRepository();
    const result = await new GetPenetrationMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(result.denominator).toBe(10);
    expect(result.metrics[0]).toMatchObject({
      meanShare: 0.5,
      clinicsCounted: 2,
    });
  });

  it("reports a null mean when no clinic has a calculable share", async () => {
    const { repository } = fakeRepository({
      averageShareByDefinition: async () => [
        {
          definitionId: 1,
          key: "ampolas_mes",
          label: "Ampolas/mês",
          meanShare: null,
          clinicsCounted: 0,
        },
      ],
    });
    const result = await new GetPenetrationMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(rep));

    expect(result.metrics[0]!.meanShare).toBeNull();
    expect(result.denominator).toBe(10);
  });
});

describe("clínicas não atribuídas", () => {
  it("counts profiles in the manager's zones with no open assignment", async () => {
    const { repository } = fakeRepository();
    const result = await new GetUnassignedClinicsMetricUseCase({
      repository,
      directory: fakeDirectory(),
    }).execute(request(manager));

    expect(result.value).toBe(6);
  });

  it("refuses a rep rather than answering zero", async () => {
    const { repository } = fakeRepository();
    await expect(
      new GetUnassignedClinicsMetricUseCase({
        repository,
        directory: fakeDirectory(),
      }).execute(request(rep)),
    ).rejects.toThrow(ForbiddenError);
  });
});

/**
 * What an admin's territory card is called.
 *
 * It used to be called "Território", full stop — the client's fallback for a
 * label the API deliberately sent as null. Singular and possessive, for a map
 * of other people's zones. An admin reading it had nothing to tell them they
 * were looking at the whole line rather than a territory of their own.
 */
describe("globalTerritoryLabel", () => {
  const zone = (
    name: string,
    ownerId: number | null,
    ownerName: string | null,
  ) => ({ name, ownerId, ownerName });

  it("counts the zones and the people holding them", () => {
    expect(
      globalTerritoryLabel([
        zone("Norte", 1, "Silvio Vieira"),
        zone("Rio de Janeiro", 2, "Pedro Poggian"),
        zone("Sao Paulo", 3, "Marcelo Moreno"),
      ]),
    ).toBe("3 territórios · 3 responsáveis");
  });

  it("names the person once the filters have narrowed to one", () => {
    // Filtering to a gerente is asking whose zones these are. Answering "2
    // territórios · 1 responsável" withholds the one fact that was requested.
    expect(
      globalTerritoryLabel([
        zone("Norte", 1, "Silvio Vieira"),
        zone("Parana", 1, "Silvio Vieira"),
      ]),
    ).toBe("2 territórios · Silvio Vieira");
  });

  it("names the zone and its owner when there is only one", () => {
    expect(globalTerritoryLabel([zone("Rio de Janeiro", 2, "Pedro Poggian")])).toBe(
      "Rio de Janeiro · Pedro Poggian",
    );
  });

  it("falls back to the zone name when the owner has no name on file", () => {
    expect(globalTerritoryLabel([zone("Rio de Janeiro", 2, null)])).toBe(
      "Rio de Janeiro",
    );
  });
});
