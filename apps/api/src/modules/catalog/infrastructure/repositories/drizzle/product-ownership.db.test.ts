import { describe, expect, test } from "bun:test";
import { products } from "@atlasmed/database";
import { eq } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * Ownership isolation, against a real database.
 *
 * Competitor products moved into `products` (spec 0013 §2). While they had
 * their own table, "a competitor product cannot appear in the catalogue" and
 * "the product admin cannot edit a competitor" were free — different tables,
 * different foreign keys. Merging bought one table at the cost of those
 * guarantees, which now rest entirely on a predicate being present in every
 * query.
 *
 * A missing predicate fails silently: no error, just the wrong rows. So the
 * isolation is asserted here rather than assumed from reading the code.
 */
const dbUp = await isDatabaseReachable();

/** Both sides, so a leak in either direction is visible. */
async function seedPair(tx: Parameters<Parameters<typeof withRollback>[0]>[0]) {
  const [own] = await tx
    .insert(products)
    .values({
      ownership: "OWN",
      code: `T-OWN-${process.pid}`,
      name: "T-OWN",
      manufacturer: "M",
      countryOfOrigin: "BR",
      price: "10",
      price17: "10",
      price18: "10",
      price20: "10",
    })
    .returning({ id: products.id });

  const [competitor] = await tx
    .insert(products)
    .values({
      ownership: "COMPETITOR",
      // No code and no price: the columns 0083 made nullable precisely because
      // a competitor's product has neither.
      name: "T-COMPETITOR",
      manufacturer: "M",
      countryOfOrigin: "BR",
      price17: "20",
      price18: "20",
      price20: "20",
    })
    .returning({ id: products.id });

  return { ownId: own!.id, competitorId: competitor!.id };
}

describe.skipIf(!dbUp)("product ownership isolation (database)", () => {
  test("a competitor product persists with no code and no price", async () => {
    await withRollback(async (tx) => {
      const { competitorId } = await seedPair(tx);

      const [row] = await tx
        .select({
          code: products.code,
          price: products.price,
          ownership: products.ownership,
        })
        .from(products)
        .where(eq(products.id, competitorId));

      // If either column were still NOT NULL the insert above would have thrown,
      // so this also pins 0083's relaxation.
      expect(row?.code).toBeNull();
      expect(row?.price).toBeNull();
      expect(row?.ownership).toBe("COMPETITOR");
    });
  });

  test("the partial unique index still rejects duplicate codes", async () => {
    await withRollback(async (tx) => {
      const { ownId } = await seedPair(tx);
      const [existing] = await tx
        .select({ code: products.code })
        .from(products)
        .where(eq(products.id, ownId));

      await expect(
        tx.insert(products).values({
          ownership: "OWN",
          code: existing!.code,
          name: "T-DUPLICATE",
          manufacturer: "M",
          countryOfOrigin: "BR",
          price: "1",
          price17: "1",
          price18: "1",
          price20: "1",
        })
      ).rejects.toThrow();
    });
  });

  test("many competitor products can coexist with no code", async () => {
    // The whole point of the partial index: NULL is not a value, so nullable
    // codes must not collide with each other.
    await withRollback(async (tx) => {
      for (const name of ["T-C1", "T-C2", "T-C3"]) {
        await tx.insert(products).values({
          ownership: "COMPETITOR",
          name,
          manufacturer: "M",
          countryOfOrigin: "BR",
          price17: "1",
          price18: "1",
          price20: "1",
        });
      }

      const rows = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.ownership, "COMPETITOR"));

      expect(rows.length).toBeGreaterThanOrEqual(3);
    });
  });
});
