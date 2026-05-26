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

  it("returns global scope for ADMIN", async () => {
    const scopeRepository = {} as ScopeRepository;
    const resolver = new ScopeResolver({ scopeRepository, territoryScopePort });

    const scope = await resolver.resolve("admin-1", Role.ADMIN);

    expect(scope.isGlobal).toBe(true);
    expect(scope.isOperationallyActive).toBe(true);
  });

  it("derives manager scope from managed users", async () => {
    const scopeRepository: ScopeRepository = {
      findTerritoryIdsByUserId: mock(async () => []),
      findTerritoryIdsByUserIds: mock(async () => ["territory-1", "territory-2"]),
      findManagedUserIds: mock(async () => ["user-1", "user-2"]),
      assignTerritory: mock(async () => undefined),
      revokeTerritory: mock(async () => undefined),
      findTerritoryAssignmentsByUserId: mock(async () => []),
      findManagerIdByUserId: mock(async () => null),
    };

    const resolver = new ScopeResolver({ scopeRepository, territoryScopePort });
    const scope = await resolver.resolve("manager-1", Role.MANAGER);

    expect(scope.managedUserIds).toEqual(["user-1", "user-2"]);
    expect(scope.territoryIds).toEqual(["territory-1", "territory-2"]);
    expect(scope.clinicIds).toEqual(["clinic-for-territory-1", "clinic-for-territory-2"]);
  });

  it("returns empty operational scope for USER without territories", async () => {
    const scopeRepository: ScopeRepository = {
      findTerritoryIdsByUserId: mock(async () => []),
      findTerritoryIdsByUserIds: mock(async () => []),
      findManagedUserIds: mock(async () => []),
      assignTerritory: mock(async () => undefined),
      revokeTerritory: mock(async () => undefined),
      findTerritoryAssignmentsByUserId: mock(async () => []),
      findManagerIdByUserId: mock(async () => null),
    };

    const resolver = new ScopeResolver({ scopeRepository, territoryScopePort });
    const scope = await resolver.resolve("user-1", Role.USER);

    expect(scope.territoryIds).toEqual([]);
    expect(scope.clinicIds).toEqual([]);
    expect(scope.isOperationallyActive).toBe(false);
  });
});
