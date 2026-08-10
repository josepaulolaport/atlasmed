import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../infrastructure/database/db";
import { assertMigrated, isDatabaseReachable, withRollback } from "./db-harness";

/**
 * The harness is test infrastructure, so it needs its own proof. A rollback
 * helper that silently committed would make every test built on it dishonest —
 * they would pass while leaving rows behind, and the isolation they claim would
 * be fiction.
 *
 * Skips wholesale without a reachable database; CI always has one.
 */
const dbUp = await isDatabaseReachable();

describe.skipIf(!dbUp)("db harness", () => {
  test("the database is migrated, not just reachable", async () => {
    await assertMigrated();
  });

  test("PostGIS is available", async () => {
    // Territory work is all ST_* predicates. A plain postgres image would let
    // tests connect and then fail deep inside a query with no obvious cause.
    const [row] = await db.execute<{ present: boolean }>(sql`
      SELECT to_regclass('public.geometry_columns') IS NOT NULL AS present
    `);
    expect(row?.present).toBe(true);
  });

  test("returns the callback's value", async () => {
    const value = await withRollback(async () => 42);
    expect(value).toBe(42);
  });

  test("writes are visible inside the transaction", async () => {
    const seen = await withRollback(async (tx) => {
      await tx.execute(sql`CREATE TEMP TABLE harness_probe (id int)`);
      await tx.execute(sql`INSERT INTO harness_probe (id) VALUES (1)`);
      const [row] = await tx.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM harness_probe`
      );
      return row?.count;
    });

    expect(seen).toBe(1);
  });

  /**
   * The one that matters. Writes a real row to a real table, then asserts from
   * *outside* the transaction that it is gone. If rollback were a no-op this is
   * the only test here that would catch it.
   */
  test("writes are gone afterwards", async () => {
    const probe = `harness-${process.pid}-${performance.now()}`;

    await withRollback(async (tx) => {
      await tx.execute(
        sql`INSERT INTO public.business_verticals (code, name, is_active)
            VALUES (${probe}, ${probe}, false)`
      );

      const [inside] = await tx.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM public.business_verticals WHERE code = ${probe}`
      );
      expect(inside?.count).toBe(1);
    });

    const [outside] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM public.business_verticals WHERE code = ${probe}`
    );
    expect(outside?.count).toBe(0);
  });

  test("a failing test still rolls back, and its error propagates", async () => {
    const probe = `harness-fail-${process.pid}-${performance.now()}`;
    const boom = new Error("boom");

    await expect(
      withRollback(async (tx) => {
        await tx.execute(
          sql`INSERT INTO public.business_verticals (code, name, is_active)
              VALUES (${probe}, ${probe}, false)`
        );
        throw boom;
      })
    ).rejects.toBe(boom);

    const [outside] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM public.business_verticals WHERE code = ${probe}`
    );
    expect(outside?.count).toBe(0);
  });
});
