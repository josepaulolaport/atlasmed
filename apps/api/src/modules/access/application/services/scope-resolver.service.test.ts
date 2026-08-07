import { describe, expect, it, mock } from "bun:test";
import { ScopeResolver } from "./scope-resolver.service";
import { Role } from "@atlasmed/access";
import type {
  FacilityAssociationPort,
  ScopeRepository,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";

const VERTICAL_A = 10;
const VERTICAL_DERM = 20;
const MANAGER_ZONE = 50;
const PATCH = 60;
const ADMIN_ID = 1;
const OPS_ID = 2;
const REP_ID = 3;
const MANAGER_ID = 4;
const MANAGED_REP_ID = 5;

describe("ScopeResolver", () => {
  const territoryScopePort: TerritoryScopePort = {
    getFacilityIdsForTerritories: mock(async (territoryIds: number[]) =>
      territoryIds.map((id) => 10_000 + id),
    ),
    getFacilityIdsForVerticals: mock(async (verticalIds: number[]) =>
      verticalIds.map((id) => 20_000 + id),
    ),
  };

  const territoryHierarchyPort = {
    resolveEffectiveTerritoryIds: mock(async (assignedTerritoryIds: number[]) => [
      ...assignedTerritoryIds,
      ...assignedTerritoryIds.map((id) => id * 1_000 + 1),
    ]),
  };

  const emptyAssociationPort: FacilityAssociationPort = {
    getAssociatedFacilityIds: mock(async () => []),
  };

  function emptyScopeRepository(
    overrides: Partial<ScopeRepository> = {},
  ): ScopeRepository {
    return {
      findTerritoryIdsByUserId: mock(async () => []),
      findTerritoryIdsByUserIds: mock(async () => []),
      findManagedUserIds: mock(async () => []),
      assignTerritory: mock(async () => undefined),
      revokeTerritory: mock(async () => undefined),
      findTerritoryAssignmentsByUserId: mock(async () => []),
      findUserIdsByTerritoryId: mock(async () => []),
      findManagerIdByUserId: mock(async () => null),
      findVerticalIdsByUserId: mock(async () => []),
      assignVertical: mock(async () => undefined),
      revokeVertical: mock(async () => undefined),
      findVerticalAssignmentsByUserId: mock(async () => []),
      replaceAssignments: mock(async () => undefined),
      listActiveVerticals: mock(async () => []),
      ...overrides,
    };
  }

  function createResolver(params: {
    scopeRepository?: ScopeRepository;
    facilityAssociationPort?: FacilityAssociationPort;
    territoryScopePort?: TerritoryScopePort;
  } = {}) {
    return new ScopeResolver({
      scopeRepository: params.scopeRepository ?? ({} as ScopeRepository),
      territoryScopePort: params.territoryScopePort ?? territoryScopePort,
      territoryHierarchyPort,
      facilityAssociationPort:
        params.facilityAssociationPort ?? emptyAssociationPort,
    });
  }

  it("returns global scope for ADMIN using user_vertical_assignments when present", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findVerticalIdsByUserId: mock(async () => [VERTICAL_DERM]),
        listActiveVerticals: mock(async () => [
          { id: VERTICAL_A, code: "ORTOPEDIA", name: "Ortopédica" },
          { id: VERTICAL_DERM, code: "DERMATOLOGIA", name: "Estética" },
        ]),
      }),
    }).resolve(ADMIN_ID, Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.isOperationallyActive).toBe(true);
    expect(scope.assignedVerticalIds).toEqual([VERTICAL_DERM]);
  });

  it("falls back to all active verticals when ADMIN has no UVA rows", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findVerticalIdsByUserId: mock(async () => []),
        listActiveVerticals: mock(async () => [
          { id: VERTICAL_A, code: "ORTOPEDIA", name: "Ortopédica" },
        ]),
      }),
    }).resolve(ADMIN_ID, Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.assignedVerticalIds).toEqual([VERTICAL_A]);
  });

  it("returns OPS profiled facilities for assigned verticals (not territory geo)", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findVerticalIdsByUserId: mock(async () => [VERTICAL_A]),
        findTerritoryIdsByUserId: mock(async () => [1]),
      }),
    }).resolve(OPS_ID, Role.OPS);

    expect(scope.isGlobal).toBe(false);
    expect(scope.assignedVerticalIds).toEqual([VERTICAL_A]);
    expect(scope.assignedTerritoryIds).toEqual([1]);
    expect(scope.facilityIds).toEqual([20_000 + VERTICAL_A]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("keeps REP patch UTA for effective territories but not clinic geo scope", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => [1]),
      }),
    }).resolve(REP_ID, Role.REP);

    expect(scope.assignedTerritoryIds).toEqual([1]);
    expect(scope.effectiveTerritoryIds).toEqual([1, 1001]);
    expect(scope.facilityIds).toEqual([]);
  });

  it("uses consultant assignments only for REP facilityIds", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => [1]),
      }),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => [20001]),
      },
    }).resolve(REP_ID, Role.REP);

    expect(scope.facilityIds).toEqual([20001]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("keeps REP operationally active when only consultant associations exist", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository(),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => [20001]),
      },
    }).resolve(REP_ID, Role.REP);

    expect(scope.facilityIds).toEqual([20001]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("splits manager oversight and analytics clinic scope", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async (userId: number) =>
          userId === MANAGER_ID ? [MANAGER_ZONE] : [],
        ),
        findTerritoryIdsByUserIds: mock(async () => [PATCH]),
        findManagedUserIds: mock(async () => [MANAGED_REP_ID]),
      }),
    }).resolve(MANAGER_ID, Role.MANAGER);

    expect(scope.assignedTerritoryIds).toEqual([MANAGER_ZONE]);
    expect(scope.reportAssignedTerritoryIds).toEqual([PATCH]);
    expect(scope.effectiveTerritoryIds).toEqual([MANAGER_ZONE, 50_001]);
    expect(scope.analyticsEffectiveTerritoryIds).toEqual([PATCH, 60_001]);
  });

  it("unions manager consultant associations into oversight facilityIds only", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => [MANAGER_ZONE]),
        findManagedUserIds: mock(async () => [MANAGED_REP_ID]),
        findTerritoryIdsByUserIds: mock(async () => [PATCH]),
      }),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => [20002]),
      },
    }).resolve(MANAGER_ID, Role.MANAGER);

    expect(scope.facilityIds).toContain(20002);
    expect(scope.facilityIds).toContain(10_000 + MANAGER_ZONE);
    expect(scope.analyticsFacilityIds).not.toContain(20002);
  });

  it("includes assigned vertical IDs for REP", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => [1, 2]),
        findVerticalIdsByUserId: mock(async () => [VERTICAL_A]),
      }),
    }).resolve(REP_ID, Role.REP);

    expect(scope.assignedTerritoryIds).toEqual([1, 2]);
    expect(scope.assignedVerticalIds).toEqual([VERTICAL_A]);
  });
});
