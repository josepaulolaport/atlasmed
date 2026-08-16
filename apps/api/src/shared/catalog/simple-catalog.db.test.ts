import { describe, expect, test } from "bun:test";
import { clinicalFocuses, healthcareSpecialties } from "@atlasmed/database";
import { eq, like, sql } from "drizzle-orm";
import { db } from "../../infrastructure/database/db";
import { isDatabaseReachable } from "../../test-utils/db-harness";
import { createSimpleCatalogRepository } from "./simple-catalog";
import { healthcareSpecialtyCatalog } from "./support-catalogs";

/**
 * The shared support-catalogue writes (spec 0016 §5.2), against a real Postgres.
 *
 * `createSimpleCatalogRepository` builds its statements from column *objects*,
 * so the parts most likely to be wrong are the ones a type-checker cannot see:
 * that the generated `INSERT`/`UPDATE` name the right columns, and that a blank
 * optional field is stored as `null` rather than `""` — these tables are unique
 * where present, so `""` would make the second uncoded row collide with the
 * first.
 *
 * Not run under `withRollback`: the repository uses the module `db` directly, so
 * each test cleans up the rows it made. The marker keeps that cleanup exact.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-SIMPLECAT-";

const catalog = createSimpleCatalogRepository({
  table: clinicalFocuses,
  id: clinicalFocuses.id,
  name: clinicalFocuses.name,
  isActive: clinicalFocuses.isActive,
  extra: clinicalFocuses.cnesCode,
});

async function cleanup() {
  await db.delete(clinicalFocuses).where(like(clinicalFocuses.name, `${MARK}%`));
}

describe.skipIf(!dbUp)("simple catalog repository (database)", () => {
  test("creates a row with its optional second column", async () => {
    try {
      const created = await catalog.create({
        name: `${MARK}com-codigo`,
        extra: '  0142  ',
      });

      expect(created.id).toBeGreaterThan(0);
      expect(created.name).toBe(`${MARK}com-codigo`);
      // Trimmed, because a code with spaces around it is a different string to
      // every lookup that ever compares it.
      expect(created.extra).toBe("0142");
      expect(created.isActive).toBeTrue();
    } finally {
      await cleanup();
    }
  });

  test("stores a blank second column as null, not as an empty string", async () => {
    try {
      const first = await catalog.create({ name: `${MARK}sem-a`, extra: "   " });
      const second = await catalog.create({ name: `${MARK}sem-b`, extra: "" });

      // The unique index is partial (`where cnes_code is not null`), so two
      // nulls coexist where two `""` would collide.
      expect(first.extra).toBeNull();
      expect(second.extra).toBeNull();
    } finally {
      await cleanup();
    }
  });

  test("renames and deactivates, and lists reflect both", async () => {
    try {
      const created = await catalog.create({ name: `${MARK}antigo` });

      const renamed = await catalog.update(created.id, {
        name: `${MARK}novo`,
        isActive: false,
      });
      expect(renamed?.name).toBe(`${MARK}novo`);
      expect(renamed?.isActive).toBeFalse();

      // The picker hides it; the admin list keeps it, which is what makes
      // reactivation possible (spec 0016 §4).
      const active = await catalog.listActive();
      const all = await catalog.listAll();
      expect(active.some((row) => row.id === created.id)).toBeFalse();
      expect(all.some((row) => row.id === created.id)).toBeTrue();
    } finally {
      await cleanup();
    }
  });

  test("a PATCH with nothing in it returns the row instead of failing", async () => {
    // An empty `SET` is a syntax error, not a no-op, so this is the one shape
    // that would 500 rather than doing nothing.
    try {
      const created = await catalog.create({ name: `${MARK}intacto` });

      const unchanged = await catalog.update(created.id, {});

      expect(unchanged?.id).toBe(created.id);
      expect(unchanged?.name).toBe(`${MARK}intacto`);
    } finally {
      await cleanup();
    }
  });

  test("a specialty may be created without a CNES id, twice", async () => {
    // Migration 0117: `cnes_id` is nullable with a *partial* unique index, so
    // two locally-created specialties coexist. Under the old `NOT NULL UNIQUE`
    // this was impossible without inventing official ids.
    try {
      const first = await healthcareSpecialtyCatalog.create({
        name: `${MARK}sem-cnes-a`,
      });
      const second = await healthcareSpecialtyCatalog.create({
        name: `${MARK}sem-cnes-b`,
      });

      expect(first.extra).toBeNull();
      expect(second.extra).toBeNull();
    } finally {
      await db
        .delete(healthcareSpecialties)
        .where(like(healthcareSpecialties.name, `${MARK}%`));
    }
  });

  test("a CNES id round-trips as a string even though the column is bigint", async () => {
    // One client model covers all four catalogues, so `extra` leaves as text
    // whatever the column's type.
    try {
      const created = await healthcareSpecialtyCatalog.create({
        name: `${MARK}com-cnes`,
        extra: "999001",
      });

      expect(created.extra).toBe("999001");
      const [reread] = await healthcareSpecialtyCatalog
        .listAll()
        .then((rows) => rows.filter((row) => row.id === created.id));
      expect(reread?.extra).toBe("999001");
    } finally {
      await db
        .delete(healthcareSpecialties)
        .where(like(healthcareSpecialties.name, `${MARK}%`));
    }
  });

  test("ON CONFLICT (cnes_id) still works on specialties", async () => {
    /*
     * The regression this exists to prevent.
     *
     * Making `cnes_id` nullable is what the admin panel needed. The tempting way
     * to keep it unique afterwards is the partial-index form `products.code`
     * uses — `UNIQUE … WHERE cnes_id IS NOT NULL` — and it is wrong here:
     * Postgres cannot infer a partial index as an `ON CONFLICT` arbiter unless
     * the statement repeats the predicate, so every `on conflict (cnes_id)`
     * against this table starts failing with SQLSTATE 42P10.
     *
     * A plain `UNIQUE` on a nullable column already allows unlimited NULLs, so
     * it buys the same thing and breaks nothing. This table is a CNES mirror and
     * an upsert keyed on `cnes_id` is its natural shape — the day someone
     * automates that sync, this must still work.
     */
    const cnesId = 990_777;
    try {
      await db.execute(sql`
        insert into healthcare_specialties (cnes_id, name)
          values (${cnesId}, ${`${MARK}upsert`})
          on conflict (cnes_id) do nothing
      `);
      await db.execute(sql`
        insert into healthcare_specialties (cnes_id, name)
          values (${cnesId}, ${`${MARK}upsert-again`})
          on conflict (cnes_id) do nothing
      `);

      const rows = await db
        .select({ id: healthcareSpecialties.id })
        .from(healthcareSpecialties)
        .where(eq(healthcareSpecialties.cnesId, cnesId));
      // Arbitrated, not merely tolerated: the second insert was skipped.
      expect(rows).toHaveLength(1);
    } finally {
      await db
        .delete(healthcareSpecialties)
        .where(like(healthcareSpecialties.name, `${MARK}%`));
    }
  });

  test("refuses a CNES id that is not a number instead of silently dropping it", async () => {
    // "I typed 12a and it saved with no code" is the shape of quiet wrongness a
    // catalogue never recovers from.
    await expect(
      healthcareSpecialtyCatalog.create({
        name: `${MARK}cnes-invalido`,
        extra: "12a",
      })
    ).rejects.toThrow();
  });

  test("reports a missing row as null rather than inventing one", async () => {
    expect(await catalog.update(2_000_000_000, { name: `${MARK}fantasma` })).toBeNull();
    const leftovers = await db
      .select({ id: clinicalFocuses.id })
      .from(clinicalFocuses)
      .where(eq(clinicalFocuses.name, `${MARK}fantasma`));
    expect(leftovers).toBeEmpty();
  });
});
