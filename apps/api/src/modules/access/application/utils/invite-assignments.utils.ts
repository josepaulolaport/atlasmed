import type { InviteVerticalAssignmentInput } from "@atlasmed/access";

export type NormalizedInviteAssignments = {
  managerId?: string;
  managerTerritoryId?: string;
  repTerritoryId?: string;
  verticalAssignments: Array<{
    verticalId: string;
    managerId?: string;
    territoryIds: string[];
  }>;
};

/**
 * Prefer multi-vertical payload; otherwise keep legacy single-territory fields
 * (verticalAssignments empty — accept still reads legacy columns).
 */
export function normalizeInviteAssignments(input: {
  roleName: string;
  managerId?: string;
  managerTerritoryId?: string;
  repTerritoryId?: string;
  verticalAssignments?: InviteVerticalAssignmentInput[];
}): NormalizedInviteAssignments {
  const verticals = (input.verticalAssignments ?? [])
    .map((v) => ({
      verticalId: v.verticalId,
      ...(v.managerId ? { managerId: v.managerId } : {}),
      territoryIds: [...new Set(v.territoryIds ?? [])],
    }))
    .filter((v) => v.verticalId);

  if (verticals.length === 0) {
    return {
      ...(input.managerId ? { managerId: input.managerId } : {}),
      ...(input.managerTerritoryId
        ? { managerTerritoryId: input.managerTerritoryId }
        : {}),
      ...(input.repTerritoryId ? { repTerritoryId: input.repTerritoryId } : {}),
      verticalAssignments: [],
    };
  }

  const first = verticals[0]!;
  const firstTerritory = first.territoryIds[0];
  const firstManager =
    first.managerId ??
    verticals.map((v) => v.managerId).find((id): id is string => Boolean(id));

  const managerTerritoryId =
    input.roleName === "MANAGER" ? firstTerritory : undefined;
  const repTerritoryId = input.roleName === "REP" ? firstTerritory : undefined;

  return {
    ...(firstManager ? { managerId: firstManager } : {}),
    ...(managerTerritoryId ? { managerTerritoryId } : {}),
    ...(repTerritoryId ? { repTerritoryId } : {}),
    verticalAssignments: verticals,
  };
}
