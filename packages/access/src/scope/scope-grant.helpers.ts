import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import type { ScopeContext } from "../contracts/scope-context.contract";

export function mergeGrantsIntoScope(
  scope: ScopeContext,
  grants: AccessGrantRecord[]
): ScopeContext {
  const grantIds = grants.map((g) => g.id);
  const territoryIds = new Set(scope.territoryIds);
  const clinicIds = new Set(scope.clinicIds);

  for (const grant of grants) {
    const resource = grant.resource.toUpperCase();
    if (!grant.resourceId) {
      continue;
    }

    if (resource === "TERRITORY") {
      territoryIds.add(grant.resourceId);
    }

    if (resource === "CLINIC") {
      clinicIds.add(grant.resourceId);
    }
  }

  return {
    ...scope,
    grantIds,
    territoryIds: [...territoryIds],
    clinicIds: [...clinicIds],
    isOperationallyActive:
      scope.isOperationallyActive ||
      territoryIds.size > 0 ||
      clinicIds.size > 0,
  };
}
