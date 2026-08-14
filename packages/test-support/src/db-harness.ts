import { sql } from "drizzle-orm";
import type { Database } from "@atlasmed/database";

/**
 * Database-backed test harness, shared by every app that owns code which can
 * only fail against real Postgres.
 *
 * It lived twice — once in `apps/api`, once in `apps/workers/temporal` — because
 * each app has its own database handle and neither may import the other. The
 * handle is the only thing that actually differed, so it is a parameter now and
 * the rules below are stated in one place. Each app keeps a thin
 * `test-utils/db-harness.ts` that binds its own `db`.
 *
 * Two rules, both from failure modes this repo has already paid for:
 *
 * 1. **Skip, never fail, when there is no database.** Contributors without a
 *    local Postgres must still be able to run `bun test`, and CI always has one.
 *    Gating on `DATABASE_URL` does not work: it is set on every machine, so the
 *    tests failed with an auth error instead of skipping. Open a connection and
 *    ask instead.
 *
 *    The cost of this rule is real and worth stating: **a green local run does
 *    not mean these tests ran.** Check the file count. See "Never let a failure
 *    become silence" in AGENTS.md, and `apps/api/.env.test.example`.
 *
 * 2. **Roll back rather than clean up.** Tests that delete their own rows leave
 *    residue whenever a run is aborted, and two concurrent runs can still
 *    collide. A transaction that is always rolled back cannot leak, cannot
 *    collide, and needs no teardown.
 */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Thrown to unwind the transaction. Never escapes `withRollback`. */
class RollbackSignal extends Error {
  constructor() {
    super("rollback");
  }
}

export type DbHarness = {
  isDatabaseReachable: () => Promise<boolean>;
  withRollback: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
  assertMigrated: () => Promise<void>;
};

export function createDbHarness(db: Database): DbHarness {
  let reachable: Promise<boolean> | undefined;

  /**
   * Whether a usable database is actually there.
   *
   * Callers await this once at module load and pass the result to
   * `describe.if` / `describe.skipIf`. Memoised so a suite of files pays for
   * one probe.
   */
  function isDatabaseReachable(): Promise<boolean> {
    reachable ??= db
      .execute(sql`SELECT 1`)
      .then(() => true)
      .catch(() => false);

    return reachable;
  }

  /**
   * Runs `fn` inside a transaction that is *always* rolled back, and returns
   * whatever `fn` returned.
   *
   * Everything written inside is visible to `fn` and invisible afterwards, so
   * tests can seed freely without teardown. A test that fails still rolls back:
   * the real error propagates and the transaction unwinds with it.
   *
   * The transaction handle must be threaded into the code under test — any query
   * issued against the module-level `db` runs on a different connection and will
   * not see the seeded rows.
   */
  async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
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

  /**
   * Asserts the database is not merely reachable but *migrated* — a connection
   * to an empty database would otherwise produce a wall of confusing "relation
   * does not exist" failures rather than one clear one.
   */
  async function assertMigrated(): Promise<void> {
    const [row] = await db.execute<{ present: boolean }>(sql`
      SELECT to_regclass('public.facilities') IS NOT NULL AS present
    `);

    if (!row?.present) {
      throw new Error(
        "Test database is reachable but not migrated — run `bun --cwd packages/database run db:migrate`."
      );
    }
  }

  return { isDatabaseReachable, withRollback, assertMigrated };
}

/**
 * A two-character `states.abbreviation` no other fixture is using.
 *
 * The column is `char(2)` and UNIQUE, so there are only 1 296 values, and some
 * suites commit their fixtures into the same database instead of rolling back —
 * the CNES loader's test leaves a permanent `ZZ` behind. A literal here makes a
 * test's outcome depend on what else has ever run against the database.
 *
 * The counter guarantees uniqueness within a run; the random first character
 * spreads separate runs and parallel files apart. It throws rather than
 * colliding silently once a run exhausts its 36 slots.
 *
 * Takes no database, so it lives outside `createDbHarness`.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let abbreviationCounter = 0;

export function uniqueAbbreviation(): string {
  if (abbreviationCounter >= ALPHABET.length) {
    throw new Error(
      "uniqueAbbreviation exhausted — seed fewer states per test run"
    );
  }
  const head = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  const tail = ALPHABET[abbreviationCounter]!;
  abbreviationCounter += 1;
  return `${head}${tail}`;
}
