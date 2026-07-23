import type { InviteSectorAssignmentInput } from "@atlasmed/access";

export type NormalizedInviteAssignments = {
  managerId?: string;
  managerTerritoryId?: string;
  repTerritoryId?: string;
  sectorAssignments: Array<{
    sectorId: string;
    managerId?: string;
    territoryIds: string[];
  }>;
};

/**
 * Prefer multi-sector payload; otherwise keep legacy single-territory fields
 * (sectorAssignments empty — accept still reads legacy columns).
 */
export function normalizeInviteAssignments(input: {
  roleName: string;
  managerId?: string;
  managerTerritoryId?: string;
  repTerritoryId?: string;
  sectorAssignments?: InviteSectorAssignmentInput[];
}): NormalizedInviteAssignments {
  const sectors = (input.sectorAssignments ?? [])
    .map((s) => ({
      sectorId: s.sectorId,
      ...(s.managerId ? { managerId: s.managerId } : {}),
      territoryIds: [...new Set(s.territoryIds ?? [])],
    }))
    .filter((s) => s.sectorId);

  if (sectors.length === 0) {
    return {
      ...(input.managerId ? { managerId: input.managerId } : {}),
      ...(input.managerTerritoryId
        ? { managerTerritoryId: input.managerTerritoryId }
        : {}),
      ...(input.repTerritoryId ? { repTerritoryId: input.repTerritoryId } : {}),
      sectorAssignments: [],
    };
  }

  const first = sectors[0]!;
  const firstTerritory = first.territoryIds[0];
  const firstManager =
    first.managerId ??
    sectors.map((s) => s.managerId).find((id): id is string => Boolean(id));

  const managerTerritoryId =
    input.roleName === "MANAGER" ? firstTerritory : undefined;
  const repTerritoryId = input.roleName === "REP" ? firstTerritory : undefined;

  return {
    ...(firstManager ? { managerId: firstManager } : {}),
    ...(managerTerritoryId ? { managerTerritoryId } : {}),
    ...(repTerritoryId ? { repTerritoryId } : {}),
    sectorAssignments: sectors,
  };
}
