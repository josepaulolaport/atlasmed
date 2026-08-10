/** Request header for optional vertical filter (must be ⊆ token assigns). */
export const VERTICAL_ID_HEADER = "x-atlasmed-vertical-id";

/**
 * Whether `verticalId` is allowed for this actor given token assignments.
 * All roles (incl. ADMIN): must be in `assignedVerticalIds` from scope/UVA.
 */
export function canAccessVertical(input: {
  /** Unused — access is decided by UVA alone, incl. for ADMIN. Kept for call-site readability. */
  role?: string;
  assignedVerticalIds: number[];
  verticalId: number;
}): boolean {
  const { assignedVerticalIds, verticalId } = input;
  if (!verticalId) return false;
  if (assignedVerticalIds.length === 0) return false;
  return assignedVerticalIds.includes(verticalId);
}

/**
 * Resolve vertical ids for a request.
 * - Omit filter → all assigned (from scope / user_vertical_assignments).
 * - Filter (header or query) → single id if allowed; else not accessible.
 */
export function resolveAccessibleVerticalIds(input: {
  /** Unused — see `canAccessVertical`. */
  role?: string;
  assignedVerticalIds: number[];
  /** Optional narrowing filter (header preferred over query). */
  filterVerticalId?: number | null;
}): { ok: true; verticalIds: number[] } | { ok: false; reason: "forbidden" } {
  const filter = input.filterVerticalId ?? null;

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
