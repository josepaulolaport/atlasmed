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
  const clinicIds = new Set(scope.clinicIds);
  const analyticsClinicIds = new Set(scope.analyticsClinicIds);

  for (const grant of grants) {
    const resource = grant.resource.toUpperCase();
    if (!grant.resourceId) {
      continue;
    }

    if (resource === "TERRITORY") {
      effectiveTerritoryIds.add(grant.resourceId);
      analyticsEffectiveTerritoryIds.add(grant.resourceId);
    }

    if (resource === "CLINIC") {
      clinicIds.add(grant.resourceId);
      analyticsClinicIds.add(grant.resourceId);
    }
  }

  return withTerritoryScopeAliases({
    ...scope,
    grantIds,
    effectiveTerritoryIds: [...effectiveTerritoryIds],
    analyticsEffectiveTerritoryIds: [...analyticsEffectiveTerritoryIds],
    clinicIds: [...clinicIds],
    analyticsClinicIds: [...analyticsClinicIds],
    isOperationallyActive:
      scope.isOperationallyActive ||
      effectiveTerritoryIds.size > 0 ||
      clinicIds.size > 0,
  });
}
