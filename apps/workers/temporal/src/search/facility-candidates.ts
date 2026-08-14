import { sql } from "drizzle-orm";
import {
  FACILITY_CANDIDATE_COLUMNS,
  FACILITY_CANDIDATE_JOINS,
  FACILITY_CANDIDATE_MEMBERSHIP,
  buildFacilityCandidateDocument,
  type FacilityCandidateDocument,
  type FacilityCandidateRow,
} from "@atlasmed/facility-insights";
import { db } from "../infrastructure/db";

export { FACILITY_CANDIDATE_SETTINGS } from "@atlasmed/facility-insights";

/** Page size. Candidates are far narrower documents than facilities. */
const PAGE_SIZE = 2_000;

const COLUMNS = sql.raw(FACILITY_CANDIDATE_COLUMNS);
const JOINS = sql.raw(FACILITY_CANDIDATE_JOINS);
const MEMBERSHIP = sql.raw(FACILITY_CANDIDATE_MEMBERSHIP);

/**
 * Every candidate, paged for a full rebuild.
 *
 * Keyset, not OFFSET. `cnes_id` is the primary key and unique across all 631 973
 * rows, so this walks the index once instead of re-scanning a growing prefix on
 * every page.
 */
export async function* facilityCandidatePages(): AsyncGenerator<
  FacilityCandidateDocument[]
> {
  let lastId: string | null = null;

  while (true) {
    const rows = (await db.execute(sql`
      select ${COLUMNS}
      ${JOINS}
       where ${MEMBERSHIP}
         ${lastId === null ? sql`` : sql`and rf.cnes_id > ${lastId}`}
       order by rf.cnes_id
       limit ${PAGE_SIZE}
    `)) as unknown as FacilityCandidateRow[];

    if (rows.length === 0) return;
    lastId = rows.at(-1)!.cnes_id;
    yield rows.map(buildFacilityCandidateDocument);
  }
}
