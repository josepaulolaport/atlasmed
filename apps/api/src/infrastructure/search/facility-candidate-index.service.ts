import { sql } from "drizzle-orm";
import {
  FACILITY_CANDIDATE_COLUMNS,
  FACILITY_CANDIDATE_JOINS,
  FACILITY_CANDIDATE_MEMBERSHIP,
  buildFacilityCandidateDocument,
  type FacilityCandidateDocument,
  type FacilityCandidateRow,
} from "@atlasmed/facility-insights";
import { db } from "../database/db";
import { logger } from "../logging/logger";
import { searchService } from "./search.service";

export const FACILITY_CANDIDATE_INDEX = "facility_candidates";

const COLUMNS = sql.raw(FACILITY_CANDIDATE_COLUMNS);
const JOINS = sql.raw(FACILITY_CANDIDATE_JOINS);
const MEMBERSHIP = sql.raw(FACILITY_CANDIDATE_MEMBERSHIP);

/**
 * Refresh one establishment's candidate document, or remove it.
 *
 * **Called on every import, synchronously**, and that is the point. The index is
 * maintained only by writers that go through the application — there is no
 * scheduled full rebuild — so a missed upsert here leaves the clinic showing as
 * importable after it has been imported. The user taps it again and hits a bare
 * unique-index violation on `cnes_code` with nothing to explain it.
 *
 * Failure is logged and swallowed: Meili is an accelerator, and an import that
 * succeeded in Postgres must not be reported as failed because the index lagged.
 * The document is stale until the next rebuild, which is a smaller wrong than
 * losing the clinic.
 */
export async function upsertFacilityCandidateDocument(
  cnesCode: string
): Promise<void> {
  if (!searchService.isConfigured()) return;

  try {
    const rows = (await db.execute(sql`
      select ${COLUMNS}
      ${JOINS}
       where rf.cnes_id = ${cnesCode}
         and ${MEMBERSHIP}
       limit 1
    `)) as unknown as FacilityCandidateRow[];

    const row = rows[0];
    if (!row) {
      // No longer a candidate at all — deactivated, or a type we stopped
      // importing. Leaving the document behind would offer a clinic the import
      // use case now refuses.
      await searchService.deleteDocument(FACILITY_CANDIDATE_INDEX, cnesCode);
      return;
    }

    await searchService.updateDocuments(FACILITY_CANDIDATE_INDEX, [
      buildFacilityCandidateDocument(row),
    ]);
  } catch (error) {
    logger.warn("search.facility_candidate_upsert_failed", { cnesCode, error });
  }
}

export interface FacilityCandidateSearchInput {
  query: string;
  /** The caller's verticals. A clinic already covered by one is not offered. */
  verticalIds: number[];
  municipalityId?: number | null;
  stateId?: number | null;
  unitTypeId?: number | null;
  legalDocumentType?: "CNPJ" | "CPF" | null;
  /** Sorts by distance from here, after relevance. */
  near?: { lat: number; lng: number } | null;
  limit: number;
  offset: number;
}

/**
 * The offer list (spec 0015 §6.1).
 *
 * Two halves, one filter, because `registry.facilities` is a superset of
 * `public.facilities`:
 *
 * - `imported = false` — nobody has ever imported it
 * - `verticalIds NOT IN [mine]` — ours, but invisible to this user
 *
 * A clinic already covered by one of the caller's verticals matches neither, so
 * it drops out without a third clause: it is already in their list.
 */
export function buildFacilityCandidateFilter(
  input: FacilityCandidateSearchInput
): string[] {
  const filters: string[] = [];

  const verticals = input.verticalIds.filter((id) => Number.isFinite(id));
  filters.push(
    verticals.length === 0
      ? "imported = false"
      : `(imported = false OR verticalIds NOT IN [${verticals.join(", ")}])`
  );

  if (input.municipalityId) filters.push(`municipalityId = ${input.municipalityId}`);
  if (input.stateId) filters.push(`stateId = ${input.stateId}`);
  if (input.unitTypeId) filters.push(`unitTypeId = ${input.unitTypeId}`);
  if (input.legalDocumentType) {
    filters.push(`legalDocumentType = "${input.legalDocumentType}"`);
  }
  return filters;
}

export async function searchFacilityCandidates(
  input: FacilityCandidateSearchInput
): Promise<{ hits: FacilityCandidateDocument[]; estimatedTotal: number }> {
  if (!searchService.isConfigured()) {
    return { hits: [], estimatedTotal: 0 };
  }

  const filter = buildFacilityCandidateFilter(input).join(" AND ");
  const result = await searchService.search<FacilityCandidateDocument>(
    FACILITY_CANDIDATE_INDEX,
    input.query,
    {
      limit: input.limit,
      offset: input.offset,
      filter,
      // Relevance first. Sorting by distance ahead of it would bury an exact
      // name match under whatever happens to be nearby.
      ...(input.near
        ? { sort: [`_geoPoint(${input.near.lat}, ${input.near.lng}):asc`] }
        : {}),
    }
  );

  return {
    hits: result.hits as FacilityCandidateDocument[],
    estimatedTotal: result.estimatedTotalHits ?? result.hits.length,
  };
}
