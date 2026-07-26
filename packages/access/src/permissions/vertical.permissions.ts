import { Role } from "../enums/role.enum";

/** Request header for optional vertical filter (must be ⊆ token assigns). */
export const VERTICAL_ID_HEADER = "x-atlasmed-vertical-id";

/**
 * Whether `verticalId` is allowed for this actor given token assignments.
 * ADMIN: any id in `assignedVerticalIds` (resolver loads all active verticals).
 * Others: must be in assignedVerticalIds.
 */
export function canAccessVertical(input: {
  role: string;
  assignedVerticalIds: string[];
  verticalId: string;
}): boolean {
  const { role, assignedVerticalIds, verticalId } = input;
  if (!verticalId) return false;
  if (role === Role.ADMIN) {
    // ADMIN assigns = all active verticals from scope. Empty list: deny filter
    // (cannot authorize unknown ids; omit filter to see nothing until scope loads).
    if (assignedVerticalIds.length === 0) return false;
    return assignedVerticalIds.includes(verticalId);
  }
  return assignedVerticalIds.includes(verticalId);
}

/**
 * Resolve vertical ids for a request.
 * - Omit filter → all assigned (ADMIN = all active from scope).
 * - Filter (header or query) → single id if allowed; else not accessible.
 */
export function resolveAccessibleVerticalIds(input: {
  role: string;
  assignedVerticalIds: string[];
  /** Optional narrowing filter (header preferred over query). */
  filterVerticalId?: string | null;
}): { ok: true; verticalIds: string[] } | { ok: false; reason: "forbidden" } {
  const filter = input.filterVerticalId?.trim() || null;

  if (!filter) {
    return { ok: true, verticalIds: input.assignedVerticalIds };
  }

  if (
    !canAccessVertical({
      role: input.role,
      assignedVerticalIds: input.assignedVerticalIds,
      verticalId: filter,
    })
  ) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, verticalIds: [filter] };
}
