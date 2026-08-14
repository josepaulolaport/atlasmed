import { sql } from "drizzle-orm";
import { db } from "../infrastructure/database/db";

/**
 * Database-backed test harness for `apps/api`.
 *
 * Why this exists: #195, #197 and #201 all assert against fake repositories or
 * query shapes, so none of them proves what the database actually does. The
 * clearest example is `territory-boundary-impact.test.ts`, whose own comments
 * say the rollback it cares about "lives in DrizzleTerritoryBoundaryWriter,
 * which has no test coverage" and that asserting it against the fake would be
 * circular — the fake's `catch` performs the restore being tested.
 *
 * Two rules, both learned from the failure modes already in this repo:
 *
 * 1. **Skip, never fail, when there is no database.** Contributors without a
 *    local Postgres must still be able to run `bun test`. CI always has one
 *    (see the `postgres` service in `.github/workflows/test.yml`), so coverage
 *    is not optional where it counts. Note this means a green local run does
 *    not imply these tests ran — check CI.
 *
 * 2. **Roll back rather than clean up.** The one pre-existing DB test in the
 *    repo (`emultec-order-import-ops.test.ts`) avoids collisions by picking a
 *    random id and never deleting the rows it writes, so every run leaves
 *    residue and two concurrent runs can still collide. A transaction that is
 *    always rolled back cannot leak, cannot collide, and needs no teardown.
 */

/**
 * Whether a usable database is actually there.
 *
 * Checking `DATABASE_URL` is not enough, and that is not hypothetical: this
 * repo ships `apps/api/.env.test` pointing at `localhost:5432`, so the variable
 * is always set even on a machine with no Postgres running. Keying off it made
 * every test here fail with an auth error instead of skipping.
 *
 * So: open a connection and ask. Callers await this once at module load and
 * pass the result to `describe.skipIf`.
 */
let reachable: Promise<boolean> | undefined;

export function isDatabaseReachable(): Promise<boolean> {
  reachable ??= db
    .execute(sql`SELECT 1`)
    .then(() => true)
    .catch(() => false);

  return reachable;
}

/**
 * A two-character `states.abbreviation` no other fixture is using.
 *
 * The column is UNIQUE, and other suites commit their fixtures into the same
 * database instead of rolling back — the CNES loader's test leaves a permanent
 * `ZZ` behind. A literal makes a test's outcome depend on what else has ever
 * run against the database.
 *
 * Two independent hazards, and both have bitten:
 *
 *   1. Other fixtures. The counter guarantees uniqueness within a file; the
 *      random first character spreads separate runs and parallel files apart.
 *      It throws rather than wrapping, because a modulo would hand out a repeat
 *      on the 37th call and surface as a unique violation somewhere unrelated.
 *   2. The 27 real UFs, which exist on a production clone and not on an empty
 *      database — so a fixture that collides with one passes locally on
 *      `atlasmed_test_empty` and fails on the clone. The leading character is
 *      therefore a **digit**: every real UF is two letters, so this cannot
 *      collide with one at all, rather than merely being unlikely to.
 */
const DIGITS = "0123456789";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let abbreviationCounter = 0;

export function uniqueAbbreviation(): string {
  if (abbreviationCounter >= ALPHABET.length) {
    throw new Error(
      "uniqueAbbreviation exhausted — seed fewer states per test file",
    );
  }
  const head = DIGITS[Math.floor(Math.random() * DIGITS.length)]!;
  const tail = ALPHABET[abbreviationCounter]!;
  abbreviationCounter += 1;
  return `${head}${tail}`;
}

/** Thrown to unwind the transaction. Never escapes `withRollback`. */
const ROLLBACK = Symbol("rollback");

class RollbackSignal extends Error {
  readonly token = ROLLBACK;
  constructor() {
    super("rollback");
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction that is *always* rolled back, and returns
 * whatever `fn` returned.
 *
 * Everything written inside is visible to `fn` and invisible afterwards, so
 * tests can seed freely without teardown. A test that fails still rolls back:
 * the real error propagates and the transaction unwinds with it.
 *
 * Note the transaction handle must be threaded into the code under test — any
 * query issued against the module-level `db` runs on a different connection and
 * will not see the seeded rows.
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

/**
 * Asserts the database is not merely reachable but *migrated* — a connection to
 * an empty database would otherwise produce a wall of confusing "relation does
 * not exist" failures rather than one clear one.
 */
export async function assertMigrated(): Promise<void> {
  const [row] = await db.execute<{ present: boolean }>(sql`
    SELECT to_regclass('public.facilities') IS NOT NULL AS present
  `);

  if (!row?.present) {
    throw new Error(
      "Test database is reachable but not migrated — run `bun --cwd packages/database run db:migrate`."
    );
  }
}
