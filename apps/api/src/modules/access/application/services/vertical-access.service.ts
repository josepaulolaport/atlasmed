import { Role } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";

export interface ResolveVerticalIdsInput {
  role: string;
  assignedVerticalIds: string[];
  queryVerticalId?: string | null;
}

/**
 * Returns the vertical IDs the caller may use for filtering.
 * Throws ForbiddenError when queryVerticalId is outside the user's assignments
 * (non-ADMIN).
 */
export function resolveVerticalIds(input: ResolveVerticalIdsInput): string[] {
  const { role, assignedVerticalIds, queryVerticalId } = input;

  if (role === Role.ADMIN) {
    if (queryVerticalId) {
      return [queryVerticalId];
    }
    return assignedVerticalIds;
  }

  if (queryVerticalId) {
    if (!assignedVerticalIds.includes(queryVerticalId)) {
      throw new ForbiddenError();
    }
    return [queryVerticalId];
  }

  return assignedVerticalIds;
}
