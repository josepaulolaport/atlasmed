import type { Role } from "../enums/role.enum";

export interface ScopeContext {
  isGlobal: boolean;
  /** Direct territory assignments for this user (not expanded). */
  assignedTerritoryIds: number[];
  /**
   * Business verticals this user may operate in.
   * ADMIN: typically all active vertical ids (or empty meaning “all”).
   * OPS/MANAGER/REP: from user_vertical_assignments.
   */
  assignedVerticalIds?: number[];
  /**
   * Optional request filter narrowing assignedVerticalIds to one vertical.
   * Set by VerticalAccess resolution from query/body `verticalId`.
   */
  activeVerticalId?: number | null;
  /**
   * Oversight territories (expanded): manager's own assignments, or all assignments for USER.
   * Used for facility/professional list visibility and territory read scope.
   */
  effectiveTerritoryIds: number[];
  /**
   * Analytics territories (expanded): for managers, direct reports' assignments only;
   * for USER, same as effectiveTerritoryIds.
   */
  analyticsEffectiveTerritoryIds: number[];
  /** @deprecated Use effectiveTerritoryIds */
  territoryIds: number[];
  /** Facilities visible for operational list/detail (oversight). */
  facilityIds: number[];
  /** Facilities included in manager analytics roll-ups (rep-controlled territories). */
  analyticsFacilityIds: number[];
  /** @deprecated Use facilityIds */
  clinicIds: number[];
  /** @deprecated Use analyticsFacilityIds */
  analyticsClinicIds: number[];
  managedUserIds: number[];
  /** Manager only: unexpanded territory IDs assigned to direct reports. */
  reportAssignedTerritoryIds?: number[];
  /**
   * Spec 0006: manager oversight manager-zone ids for clinic geo filter.
   * Prefer SQL `manager_zone_id IN oversightZoneIds` over giant facilityIds lists.
   */
  oversightZoneIds?: number[];
  isOperationallyActive: boolean;
}

export interface ScopeActor {
  userId: number;
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
    territoryIds?: number[];
    analyticsEffectiveTerritoryIds?: number[];
    analyticsFacilityIds?: number[];
    clinicIds?: number[];
    analyticsClinicIds?: number[];
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
