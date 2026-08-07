import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import type { ScopeContext } from "../contracts/scope-context.contract";
import { withTerritoryScopeAliases } from "../contracts/scope-context.contract";

function grantResourceIdAsNumber(resourceId: string): number | null {
  const trimmed = resourceId.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

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
      const territoryId = grantResourceIdAsNumber(grant.resourceId);
      if (territoryId !== null) {
        effectiveTerritoryIds.add(territoryId);
        analyticsEffectiveTerritoryIds.add(territoryId);
      }
    }

    if (resource === "FACILITY" || resource === "CLINIC") {
      const facilityId = grantResourceIdAsNumber(grant.resourceId);
      if (facilityId !== null) {
        facilityIds.add(facilityId);
        analyticsFacilityIds.add(facilityId);
      }
    }
  }

  return withTerritoryScopeAliases({
    isGlobal: scope.isGlobal,
    assignedTerritoryIds: scope.assignedTerritoryIds,
    assignedVerticalIds: scope.assignedVerticalIds,
    activeVerticalId: scope.activeVerticalId,
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
