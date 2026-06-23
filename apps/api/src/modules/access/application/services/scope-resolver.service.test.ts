import { describe, expect, it, mock } from "bun:test";
import { ScopeResolver } from "./scope-resolver.service";
import { Role } from "@atlasmed/access";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";

describe("ScopeResolver", () => {
  const territoryScopePort = {
    getClinicIdsForTerritories: mock(async (territoryIds: string[]) =>
      territoryIds.map((id) => `clinic-for-${id}`)
    ),
  };

  const territoryHierarchyPort = {
    resolveDescendantIds: mock(async (ancestorIds: string[]) => [
      ...ancestorIds,
      ...ancestorIds.map((id) => `${id}-child`),
    ]),
  };

  it("returns global scope for ADMIN", async () => {
    const scopeRepository = {} as ScopeRepository;
    const resolver = new ScopeResolver({
      scopeRepository,
      territoryScopePort,
      territoryHierarchyPort,
    });

    const scope = await resolver.resolve("admin-1", Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("expands user territory assignments via hierarchy port", async () => {
    const scopeRepository: ScopeRepository = {
      findTerritoryIdsByUserId: mock(async () => ["territory-1"]),
      findTerritoryIdsByUserIds: mock(async () => []),
      findManagedUserIds: mock(async () => []),
      assignTerritory: mock(async () => undefined),
      revokeTerritory: mock(async () => undefined),
      findTerritoryAssignmentsByUserId: mock(async () => []),
      findManagerIdByUserId: mock(async () => null),
    };

    const resolver = new ScopeResolver({
      scopeRepository,
      territoryScopePort,
      territoryHierarchyPort,
    });
    const scope = await resolver.resolve("user-1", Role.USER);

    expect(scope.assignedTerritoryIds).toEqual(["territory-1"]);
    expect(scope.effectiveTerritoryIds).toEqual(["territory-1", "territory-1-child"]);
    expect(scope.clinicIds).toEqual(["clinic-for-territory-1", "clinic-for-territory-1-child"]);
  });

  it("unions manager own and report assignments", async () => {
    const scopeRepository: ScopeRepository = {
      findTerritoryIdsByUserId: mock(async (userId: string) =>
        userId === "manager-1" ? ["region-1"] : []
      ),
      findTerritoryIdsByUserIds: mock(async () => ["patch-1"]),
      findManagedUserIds: mock(async () => ["user-1"]),
      assignTerritory: mock(async () => undefined),
      revokeTerritory: mock(async () => undefined),
      findTerritoryAssignmentsByUserId: mock(async () => []),
      findManagerIdByUserId: mock(async () => null),
    };

    const resolver = new ScopeResolver({
      scopeRepository,
      territoryScopePort,
      territoryHierarchyPort,
    });
    const scope = await resolver.resolve("manager-1", Role.MANAGER);

    expect(scope.assignedTerritoryIds.sort()).toEqual(["patch-1", "region-1"].sort());
    expect(scope.managedUserIds).toEqual(["user-1"]);
  });
});
