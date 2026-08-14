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

/**
 * Documents per Meili request.
 *
 * Sized for this index, not copied from the facilities one — that uses 500,
 * which is irrelevant at 1 442 rows and ruinous at 373 435. `rebuildSearchIndex`
 * waits for each batch to finish indexing before sending the next, so every
 * batch pays Meili's fixed per-task cost: measured at **4.8–7.1 s for 2 000
 * documents**, which is ~330 docs/s and a nineteen-minute rebuild spent almost
 * entirely on overhead paid 187 times.
 *
 * Candidate documents average 581 bytes, so 20 000 of them is ~12 MB per
 * request — inside the range Meili is happiest with, and 19 batches instead of
 * 187.
 */
const PAGE_SIZE = 20_000;

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
