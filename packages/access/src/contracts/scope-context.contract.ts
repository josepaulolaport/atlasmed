import type { Role } from "../enums/role.enum";

export interface ScopeContext {
  isGlobal: boolean;
  /** Direct territory assignments for this user (not expanded). */
  assignedTerritoryIds: string[];
  /**
   * Oversight territories (expanded): manager's own assignments, or all assignments for USER.
   * Used for clinic/doctor list visibility and territory read scope.
   */
  effectiveTerritoryIds: string[];
  /**
   * Analytics territories (expanded): for managers, direct reports' assignments only;
   * for USER, same as effectiveTerritoryIds.
   */
  analyticsEffectiveTerritoryIds: string[];
  /** @deprecated Use effectiveTerritoryIds */
  territoryIds: string[];
  /** Clinics visible for operational list/detail (oversight). */
  clinicIds: string[];
  /** Clinics included in manager analytics roll-ups (rep-controlled territories). */
  analyticsClinicIds: string[];
  managedUserIds: string[];
  /** Manager only: unexpanded territory IDs assigned to direct reports. */
  reportAssignedTerritoryIds?: string[];
  isOperationallyActive: boolean;
  grantIds?: string[];
}

export interface ScopeActor {
  userId: string;
  role: Role;
}

export function withTerritoryScopeAliases(
  scope: Omit<
    ScopeContext,
    "territoryIds" | "analyticsEffectiveTerritoryIds" | "analyticsClinicIds"
  > & {
    territoryIds?: string[];
    analyticsEffectiveTerritoryIds?: string[];
    analyticsClinicIds?: string[];
  }
): ScopeContext {
  const effectiveTerritoryIds = scope.effectiveTerritoryIds;
  const clinicIds = scope.clinicIds;
  return {
    ...scope,
    effectiveTerritoryIds,
    analyticsEffectiveTerritoryIds:
      scope.analyticsEffectiveTerritoryIds ?? effectiveTerritoryIds,
    territoryIds: scope.territoryIds ?? effectiveTerritoryIds,
    clinicIds,
    analyticsClinicIds: scope.analyticsClinicIds ?? clinicIds,
  };
}
