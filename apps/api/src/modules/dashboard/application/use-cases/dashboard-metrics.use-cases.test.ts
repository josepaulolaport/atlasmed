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
      return { active: 3, inactive: 2, neverBought: 5, total: 10 };
    },
    countRegisteredProfiles: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return { registered: 4, total: 10 };
    },
    countProfilesWithoutRep: async (filter: DashboardProfileFilter) => {
      seen.push(filter);
      return 6;
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
      directory: fakeDirectory({ findUser: async () => rep }),
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

    expect(seen[0]).toMatchObject({ repUserIds: [5], zoneIds: null });
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
        active: 0,
        inactive: 0,
        neverBought: 0,
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
    }).execute({ ...request(rep), now: new Date("2026-08-11T12:00:00Z") });

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
    }).execute({ ...request(rep), now: new Date("2026-08-11T12:00:00Z") });

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
