import {
  VERTICAL_ID_HEADER,
  resolveAccessibleVerticalIds,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import { parseCrmId } from "../../../../shared/utils/parse-crm-id";

export { VERTICAL_ID_HEADER };

export interface ResolveVerticalIdsInput {
  role: string;
  assignedVerticalIds: number[];
  /** Optional query/body filter. */
  queryVerticalId?: number | null;
  /** Optional header filter (wins over query when both set). */
  headerVerticalId?: number | null;
}

/**
 * Returns the vertical IDs the caller may use for filtering.
 * Filter source: header `X-AtlasMed-Vertical-Id` preferred, else query/body.
 * Always ∩ token assignments (`user_vertical_assignments` via scope).
 */
export function resolveVerticalIds(input: ResolveVerticalIdsInput): number[] {
  const filterVerticalId = input.headerVerticalId ?? input.queryVerticalId ?? null;

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

export function readVerticalIdHeader(
  headers: Headers | { get(name: string): string | null }
): number | null {
  const raw =
    headers.get(VERTICAL_ID_HEADER) ?? headers.get("X-AtlasMed-Vertical-Id");
  if (!raw?.trim()) {
    return null;
  }
  return parseCrmId(raw, "vertical id");
}
