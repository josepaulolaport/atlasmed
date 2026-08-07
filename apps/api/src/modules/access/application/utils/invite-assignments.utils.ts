import type { InviteVerticalAssignmentInput } from "@atlasmed/access";

export type NormalizedInviteAssignments = {
  /** Legacy single-territory columns kept for older invite rows until migrate drop. */
  managerTerritoryId?: string;
  repTerritoryId?: string;
  verticalAssignments: Array<{
    verticalId: string;
    territoryIds: string[];
    newPatch?: InviteVerticalAssignmentInput["newPatch"];
  }>;
};

/**
 * Normalize invite vertical slices. Manager link is territory-derived — no managerId.
 */
export function normalizeInviteAssignments(input: {
  roleName: string;
  verticalAssignments?: InviteVerticalAssignmentInput[];
}): NormalizedInviteAssignments {
  const verticals = (input.verticalAssignments ?? [])
    .map((v) => ({
      verticalId: v.verticalId,
      territoryIds: [...new Set(v.territoryIds ?? [])],
      ...(v.newPatch ? { newPatch: v.newPatch } : {}),
    }))
    .filter((v) => v.verticalId);

  if (verticals.length === 0) {
    return { verticalAssignments: [] };
  }

  const first = verticals[0]!;
  const firstTerritory = first.territoryIds[0];

  return {
    ...(input.roleName === "MANAGER" && firstTerritory
      ? { managerTerritoryId: firstTerritory }
      : {}),
    ...(input.roleName === "REP" && firstTerritory
      ? { repTerritoryId: firstTerritory }
      : {}),
    verticalAssignments: verticals,
  };
}
