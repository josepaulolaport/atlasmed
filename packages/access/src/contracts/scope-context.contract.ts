import type { Role } from "../enums/role.enum";

export interface ScopeContext {
  isGlobal: boolean;
  /** Direct territory assignments for this user (not expanded). */
  assignedTerritoryIds: string[];
  /**
   * Business verticals this user may operate in.
   * ADMIN: typically all active vertical ids (or empty meaning “all”).
   * OPS/MANAGER/REP: from user_vertical_assignments.
   */
  assignedVerticalIds?: string[];
  /**
   * Optional request filter narrowing assignedVerticalIds to one vertical.
   * Set by VerticalAccess resolution from query/body `verticalId`.
   */
  activeVerticalId?: string | null;
  /**
   * Oversight territories (expanded): manager's own assignments, or all assignments for USER.
   * Used for facility/professional list visibility and territory read scope.
   */
  effectiveTerritoryIds: string[];
  /**
   * Analytics territories (expanded): for managers, direct reports' assignments only;
   * for USER, same as effectiveTerritoryIds.
   */
  analyticsEffectiveTerritoryIds: string[];
  /** @deprecated Use effectiveTerritoryIds */
  territoryIds: string[];
  /** Facilities visible for operational list/detail (oversight). */
  facilityIds: string[];
  /** Facilities included in manager analytics roll-ups (rep-controlled territories). */
  analyticsFacilityIds: string[];
  /** @deprecated Use facilityIds */
  clinicIds: string[];
  /** @deprecated Use analyticsFacilityIds */
  analyticsClinicIds: string[];
  managedUserIds: string[];
  /** Manager only: unexpanded territory IDs assigned to direct reports. */
  reportAssignedTerritoryIds?: string[];
  /**
   * Spec 0006: manager oversight manager-zone ids for clinic geo filter.
   * Prefer SQL `manager_zone_id IN oversightZoneIds` over giant facilityIds lists.
   */
  oversightZoneIds?: string[];
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
    | "territoryIds"
    | "analyticsEffectiveTerritoryIds"
    | "analyticsFacilityIds"
    | "clinicIds"
    | "analyticsClinicIds"
  > & {
    territoryIds?: string[];
    analyticsEffectiveTerritoryIds?: string[];
    analyticsFacilityIds?: string[];
    clinicIds?: string[];
    analyticsClinicIds?: string[];
  }
): ScopeContext {
  const effectiveTerritoryIds = scope.effectiveTerritoryIds;
  const facilityIds = scope.facilityIds ?? scope.clinicIds ?? [];
  const analyticsFacilityIds =
    scope.analyticsFacilityIds ?? scope.analyticsClinicIds ?? facilityIds;
  return {
    ...scope,
    effectiveTerritoryIds,
    analyticsEffectiveTerritoryIds:
      scope.analyticsEffectiveTerritoryIds ?? effectiveTerritoryIds,
    territoryIds: scope.territoryIds ?? effectiveTerritoryIds,
    facilityIds,
    analyticsFacilityIds,
    clinicIds: facilityIds,
    analyticsClinicIds: analyticsFacilityIds,
  };
}
