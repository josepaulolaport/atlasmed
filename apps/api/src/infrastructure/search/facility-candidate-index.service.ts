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
import { reportSearchMeiliFallback } from "./search-resilience";
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

/**
 * The same list, straight from Postgres.
 *
 * Meili is an accelerator here as everywhere else in this app; Postgres is
 * authority (`facility.use-cases.ts`, `list-healthcare-professionals`). This
 * surface used to answer an unconfigured search with an empty list, which a user
 * cannot tell apart from "the national registry holds no clinic matching that" —
 * the one outcome the house pattern exists to prevent.
 *
 * It is honestly worse than the index: `ILIKE` over 373 435 rows, no typo
 * tolerance, no relevance ranking, no distance sort. That is the trade the
 * pattern already makes elsewhere, and a degraded list beats a lie.
 *
 * Both paths build the document from the same fragments, so a clinic cannot
 * appear with different fields depending on which one served it.
 */
async function searchFacilityCandidatesFromSql(
  input: FacilityCandidateSearchInput
): Promise<{ hits: FacilityCandidateDocument[]; estimatedTotal: number }> {
  const verticals = input.verticalIds.filter((id) => Number.isInteger(id) && id > 0);

  /*
   * The offer list, as SQL. Same two halves as the Meili filter: never imported,
   * or imported but not covered by one of this user's verticals. A clinic their
   * vertical already holds matches neither and drops out.
   */
  const offerable =
    verticals.length === 0
      ? sql`rf.atlasmed_id is null`
      : sql`(
          rf.atlasmed_id is null
          or not exists (
            select 1 from facility_vertical_profiles p
             where p.facility_id = rf.atlasmed_id and p.is_active
               and p.vertical_id in (${sql.join(
                 verticals.map((id) => sql`${id}`),
                 sql`, `
               )})
          )
        )`;

  const term = input.query.trim();
  const like = `%${term}%`;
  const matches = term
    ? sql`and (
        rf.trade_name ilike ${like} or rf.legal_name ilike ${like}
        or rf.cnes_id = ${term} or rf.tax_id_cnpj = ${term}
      )`
    : sql``;

  const where = sql`
    where ${sql.raw(FACILITY_CANDIDATE_MEMBERSHIP)}
      and ${offerable}
      ${matches}
      ${input.municipalityId ? sql`and rm.atlasmed_id = ${input.municipalityId}` : sql``}
      ${input.stateId ? sql`and rs.atlasmed_id = ${input.stateId}` : sql``}
      ${input.unitTypeId ? sql`and rut.atlasmed_id = ${input.unitTypeId}` : sql``}
      ${
        input.legalDocumentType === "CNPJ"
          ? sql`and rf.legal_person_type = '3'`
          : input.legalDocumentType === "CPF"
            ? sql`and rf.legal_person_type = '1'`
            : sql``
      }
  `;

  const rows = (await db.execute(sql`
    select ${COLUMNS}
    ${JOINS}
    ${where}
     order by rf.trade_name nulls last, rf.cnes_id
     limit ${input.limit} offset ${input.offset}
  `)) as unknown as FacilityCandidateRow[];

  /*
   * Capped. An unqualified browse matches ~373 000 rows and the exact count is
   * worth nothing to a user paging 20 at a time — Meili itself only ever returns
   * an estimate. Counting past the cap would be the most expensive query on the
   * surface, run on the degraded path.
   */
  const [counted] = (await db.execute(sql`
    select count(*)::int as n from (
      select 1 ${JOINS} ${where} limit 1000
    ) capped
  `)) as unknown as { n: number }[];

  return {
    hits: rows.map(buildFacilityCandidateDocument),
    estimatedTotal: Number(counted?.n ?? rows.length),
  };
}

export async function searchFacilityCandidates(
  input: FacilityCandidateSearchInput
): Promise<{ hits: FacilityCandidateDocument[]; estimatedTotal: number }> {
  if (!searchService.isConfigured()) {
    reportSearchMeiliFallback("facility_candidates", "meili_error", {
      reason_detail: "not_configured",
    });
    return searchFacilityCandidatesFromSql(input);
  }

  const filter = buildFacilityCandidateFilter(input).join(" AND ");
  try {
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
  } catch (error) {
    /*
     * Meili unreachable, the index missing, or a filter it refused. None of those
     * are reasons to tell a user the registry is empty — and an index that has
     * never been built is the normal state of a fresh environment.
     */
    reportSearchMeiliFallback("facility_candidates", "meili_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return searchFacilityCandidatesFromSql(input);
  }
}
