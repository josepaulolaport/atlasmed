import { sql } from "drizzle-orm";
import { db } from "../infrastructure/db";

/**
 * Database-backed test harness for the Temporal worker.
 *
 * A port of `apps/api/src/test-utils/db-harness.ts`. The worker cannot import
 * that one — it is a separate app with its own database handle — and the worker
 * owns the two pieces of code most able to fail only against real Postgres: the
 * Emultec importer and the purchase-recurrence store.
 *
 * Two rules, both from failure modes this repo has already paid for:
 *
 * 1. **Skip, never fail, when there is no database.** `DATABASE_URL` is set by
 *    `.env` on every machine, so gating on the variable makes these tests fail
 *    with a Postgres auth error rather than skip. Open a connection and ask
 *    instead. CI always has one, so nothing is lost where it counts — but note
 *    a green local run does not imply these tests ran.
 *
 * 2. **Roll back rather than clean up.** The worker's other DB test
 *    (`emultec-order-import-ops.test.ts`) picks a random id and deletes its own
 *    rows, so an aborted run leaves residue. A transaction that is always rolled
 *    back cannot leak, cannot collide, and needs no teardown.
 */

let reachable: Promise<boolean> | undefined;

export function isDatabaseReachable(): Promise<boolean> {
  reachable ??= db
    .execute(sql`SELECT 1`)
    .then(() => true)
    .catch(() => false);

  return reachable;
}

/** Thrown to unwind the transaction. Never escapes `withRollback`. */
class RollbackSignal extends Error {
  constructor() {
    super("rollback");
  }
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction that is *always* rolled back, and returns
 * whatever `fn` returned.
 *
 * The transaction handle must be threaded into the code under test — any query
 * issued against the module-level `db` runs on a different connection and will
 * not see the seeded rows.
 */
export async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T;

  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      // Unwinds the transaction. Drizzle rolls back on any throw.
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }

  return result!;
}
