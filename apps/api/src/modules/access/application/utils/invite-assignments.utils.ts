import type { InviteVerticalAssignmentInput } from "@atlasmed/access";

export type NormalizedInviteAssignments = {
  verticalAssignments: Array<{
    verticalId: number;
    territoryIds: number[];
    newPatch?: InviteVerticalAssignmentInput["newPatch"];
  }>;
};

/**
 * Normalize invite vertical slices. Manager link is territory-derived — no managerId.
 * Territory staging lives only in invitation_*_assignments tables.
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

  return { verticalAssignments: verticals };
}
