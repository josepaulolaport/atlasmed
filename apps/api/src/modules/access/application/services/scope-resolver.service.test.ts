import { describe, expect, it, mock } from "bun:test";
import { ScopeResolver } from "./scope-resolver.service";
import { Role } from "@atlasmed/access";
import type {
  FacilityAssociationPort,
  ScopeRepository,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";

describe("ScopeResolver", () => {
  const territoryScopePort: TerritoryScopePort = {
    getFacilityIdsForTerritories: mock(async (territoryIds: string[]) =>
      territoryIds.map((id) => `clinic-for-${id}`),
    ),
    getFacilityIdsForVerticals: mock(async (verticalIds: string[]) =>
      verticalIds.map((id) => `clinic-vertical-${id}`),
    ),
  };

  const territoryHierarchyPort = {
    resolveEffectiveTerritoryIds: mock(async (assignedTerritoryIds: string[]) => [
      ...assignedTerritoryIds,
      ...assignedTerritoryIds.map((id) => `${id}-patch`),
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
        findVerticalIdsByUserId: mock(async () => ["vertical-derm"]),
        listActiveVerticals: mock(async () => [
          { id: "vertical-a", code: "ORTOPEDIA", name: "Ortopédica" },
          { id: "vertical-derm", code: "DERMATOLOGIA", name: "Dermatológica" },
        ]),
      }),
    }).resolve("admin-1", Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.isOperationallyActive).toBe(true);
    expect(scope.assignedVerticalIds).toEqual(["vertical-derm"]);
  });

  it("falls back to all active verticals when ADMIN has no UVA rows", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findVerticalIdsByUserId: mock(async () => []),
        listActiveVerticals: mock(async () => [
          { id: "vertical-a", code: "ORTOPEDIA", name: "Ortopédica" },
        ]),
      }),
    }).resolve("admin-1", Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.assignedVerticalIds).toEqual(["vertical-a"]);
  });

  it("returns OPS profiled facilities for assigned verticals (not territory geo)", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findVerticalIdsByUserId: mock(async () => ["vertical-a"]),
        findTerritoryIdsByUserId: mock(async () => ["territory-1"]),
      }),
    }).resolve("ops-1", Role.OPS);

    expect(scope.isGlobal).toBe(false);
    expect(scope.assignedVerticalIds).toEqual(["vertical-a"]);
    expect(scope.assignedTerritoryIds).toEqual(["territory-1"]);
    expect(scope.facilityIds).toEqual(["clinic-vertical-vertical-a"]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("keeps REP patch UTA for effective territories but not clinic geo scope", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => ["territory-1"]),
      }),
    }).resolve("user-1", Role.REP);

    expect(scope.assignedTerritoryIds).toEqual(["territory-1"]);
    expect(scope.effectiveTerritoryIds).toEqual([
      "territory-1",
      "territory-1-patch",
    ]);
    expect(scope.facilityIds).toEqual([]);
  });

  it("uses consultant assignments only for REP facilityIds", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => ["territory-1"]),
      }),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => ["clinic-associated-1"]),
      },
    }).resolve("rep-1", Role.REP);

    expect(scope.facilityIds).toEqual(["clinic-associated-1"]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("keeps REP operationally active when only consultant associations exist", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository(),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => ["clinic-associated-1"]),
      },
    }).resolve("rep-1", Role.REP);

    expect(scope.facilityIds).toEqual(["clinic-associated-1"]);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("splits manager oversight and analytics clinic scope", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async (userId: string) =>
          userId === "manager-1" ? ["manager-zone-1"] : [],
        ),
        findTerritoryIdsByUserIds: mock(async () => ["patch-1"]),
        findManagedUserIds: mock(async () => ["user-1"]),
      }),
    }).resolve("manager-1", Role.MANAGER);

    expect(scope.assignedTerritoryIds).toEqual(["manager-zone-1"]);
    expect(scope.reportAssignedTerritoryIds).toEqual(["patch-1"]);
    expect(scope.effectiveTerritoryIds).toEqual([
      "manager-zone-1",
      "manager-zone-1-patch",
    ]);
    expect(scope.analyticsEffectiveTerritoryIds).toEqual([
      "patch-1",
      "patch-1-patch",
    ]);
  });

  it("unions manager consultant associations into oversight facilityIds only", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => ["manager-zone-1"]),
        findManagedUserIds: mock(async () => ["user-1"]),
        findTerritoryIdsByUserIds: mock(async () => ["patch-1"]),
      }),
      facilityAssociationPort: {
        getAssociatedFacilityIds: mock(async () => ["clinic-associated-mgr"]),
      },
    }).resolve("manager-1", Role.MANAGER);

    expect(scope.facilityIds).toContain("clinic-associated-mgr");
    expect(scope.facilityIds).toContain("clinic-for-manager-zone-1");
    expect(scope.analyticsFacilityIds).not.toContain("clinic-associated-mgr");
  });

  it("includes assigned vertical IDs for REP", async () => {
    const scope = await createResolver({
      scopeRepository: emptyScopeRepository({
        findTerritoryIdsByUserId: mock(async () => [
          "territory-1",
          "territory-2",
        ]),
        findVerticalIdsByUserId: mock(async () => ["vertical-a"]),
      }),
    }).resolve("rep-1", Role.REP);

    expect(scope.assignedTerritoryIds).toEqual(["territory-1", "territory-2"]);
    expect(scope.assignedVerticalIds).toEqual(["vertical-a"]);
  });
});
