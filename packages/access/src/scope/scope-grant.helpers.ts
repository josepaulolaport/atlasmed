import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import type { ScopeContext } from "../contracts/scope-context.contract";
import { withTerritoryScopeAliases } from "../contracts/scope-context.contract";

export function mergeGrantsIntoScope(
  scope: ScopeContext,
  grants: AccessGrantRecord[]
): ScopeContext {
  const grantIds = grants.map((g) => g.id);
  const effectiveTerritoryIds = new Set(scope.effectiveTerritoryIds);
  const analyticsEffectiveTerritoryIds = new Set(scope.analyticsEffectiveTerritoryIds);
  const facilityIds = new Set(scope.facilityIds);
  const analyticsFacilityIds = new Set(scope.analyticsFacilityIds);

  for (const grant of grants) {
    const resource = grant.resource.toUpperCase();
    if (!grant.resourceId) {
      continue;
    }

    if (resource === "TERRITORY") {
      effectiveTerritoryIds.add(grant.resourceId);
      analyticsEffectiveTerritoryIds.add(grant.resourceId);
    }

    if (resource === "FACILITY" || resource === "CLINIC") {
      facilityIds.add(grant.resourceId);
      analyticsFacilityIds.add(grant.resourceId);
    }
  }

  return withTerritoryScopeAliases({
    isGlobal: scope.isGlobal,
    assignedTerritoryIds: scope.assignedTerritoryIds,
    effectiveTerritoryIds: [...effectiveTerritoryIds],
    analyticsEffectiveTerritoryIds: [...analyticsEffectiveTerritoryIds],
    facilityIds: [...facilityIds],
    analyticsFacilityIds: [...analyticsFacilityIds],
    managedUserIds: scope.managedUserIds,
    reportAssignedTerritoryIds: scope.reportAssignedTerritoryIds,
    isOperationallyActive:
      scope.isOperationallyActive ||
      effectiveTerritoryIds.size > 0 ||
      facilityIds.size > 0,
    grantIds,
  });
}
