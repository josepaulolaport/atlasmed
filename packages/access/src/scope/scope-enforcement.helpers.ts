import type { ScopeContext } from "../contracts/scope-context.contract";

export type ScopedResourceType = "territory" | "clinic" | "user";

/**
 * Cross-module scope guard — use in clinic/visit modules before returning row data.
 * Phase 8: wire real TerritoryScopePort when clinic module ships.
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
      if (!scope.territoryIds.includes(resourceId)) {
        throw new Error("Resource outside scope: territory");
      }
      return;
    case "clinic":
      if (!scope.clinicIds.includes(resourceId)) {
        throw new Error("Resource outside scope: clinic");
      }
      return;
    case "user":
      if (!scope.managedUserIds.includes(resourceId)) {
        throw new Error("Resource outside scope: user");
      }
      return;
    default:
      throw new Error("Unknown scoped resource type");
  }
}
