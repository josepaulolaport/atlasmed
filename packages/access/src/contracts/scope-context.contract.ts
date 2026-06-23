import type { Role } from "../enums/role.enum";

export interface ScopeContext {
  isGlobal: boolean;
  assignedTerritoryIds: string[];
  effectiveTerritoryIds: string[];
  /** @deprecated Use effectiveTerritoryIds */
  territoryIds: string[];
  clinicIds: string[];
  managedUserIds: string[];
  isOperationallyActive: boolean;
  grantIds?: string[];
}

export interface ScopeActor {
  userId: string;
  role: Role;
}

export function withTerritoryScopeAliases(scope: Omit<ScopeContext, "territoryIds"> & { territoryIds?: string[] }): ScopeContext {
  const effectiveTerritoryIds = scope.effectiveTerritoryIds;
  return {
    ...scope,
    effectiveTerritoryIds,
    territoryIds: scope.territoryIds ?? effectiveTerritoryIds,
  };
}
