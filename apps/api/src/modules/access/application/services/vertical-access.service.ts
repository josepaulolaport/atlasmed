import {
  VERTICAL_ID_HEADER,
  resolveAccessibleVerticalIds,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";

export { VERTICAL_ID_HEADER };

export interface ResolveVerticalIdsInput {
  role: string;
  assignedVerticalIds: string[];
  /** Optional query/body filter. */
  queryVerticalId?: string | null;
  /** Optional header filter (wins over query when both set). */
  headerVerticalId?: string | null;
}

/**
 * Returns the vertical IDs the caller may use for filtering.
 * Filter source: header `X-AtlasMed-Vertical-Id` preferred, else query/body.
 * Always ∩ token assignments (`user_vertical_assignments` via scope).
 */
export function resolveVerticalIds(input: ResolveVerticalIdsInput): string[] {
  const filterVerticalId = input.headerVerticalId?.trim() || input.queryVerticalId?.trim() || null;

  const result = resolveAccessibleVerticalIds({
    role: input.role,
    assignedVerticalIds: input.assignedVerticalIds,
    filterVerticalId,
  });

  if (!result.ok) {
    throw new ForbiddenError();
  }

  return result.verticalIds;
}

export function readVerticalIdHeader(headers: Headers | { get(name: string): string | null }): string | null {
  return headers.get(VERTICAL_ID_HEADER) ?? headers.get("X-AtlasMed-Vertical-Id");
}
