import type { TerritoryBoundaryResolution } from "../services/territory-boundary.application";

export function serializeBoundaryResolution(resolution: TerritoryBoundaryResolution) {
  if (resolution.mode === "operational") {
    return {
      success: true as const,
      mode: "operational" as const,
      geoMembershipStatus: resolution.geoMembershipStatus,
      membershipCount: resolution.membershipCount,
      referenceTerritoryIds: resolution.referenceTerritoryIds,
    };
  }

  return {
    success: true as const,
    mode: "reference" as const,
    parentAssignmentStatus: resolution.parentAssignmentStatus,
    parentAssignmentSource: resolution.parentAssignmentSource,
    primaryParentId: resolution.primaryParentId,
    rollupAncestorIds: resolution.rollupAncestorIds,
    candidates: resolution.candidates,
  };
}
