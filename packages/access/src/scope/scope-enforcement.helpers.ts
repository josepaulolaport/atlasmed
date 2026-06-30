import type { ScopeContext } from "../contracts/scope-context.contract";
import { ForbiddenError } from "../errors/forbidden.error";

export type ScopedResourceType = "territory" | "facility" | "user";

/**
 * Cross-module scope guard — use in facility/professional modules before returning row data.
 * Route-level CASL (Model A) is role-wide; this is the row-level enforcement layer.
 */
export function assertResourceInScope(
  scope: ScopeContext,
  resourceType: ScopedResourceType,
  resourceId: string
): void {
  if (scope.isGlobal) {
    return;
  }

  switch (resourceType) {
    case "territory":
      if (!scope.effectiveTerritoryIds.includes(resourceId)) {
        throw new ForbiddenError("Resource outside scope: territory");
      }
      return;
    case "facility":
      if (!scope.facilityIds.includes(resourceId)) {
        throw new ForbiddenError("Resource outside scope: facility");
      }
      return;
    case "user":
      if (!scope.managedUserIds.includes(resourceId)) {
        throw new ForbiddenError("Resource outside scope: user");
      }
      return;
    default:
      throw new Error("Unknown scoped resource type");
  }
}
