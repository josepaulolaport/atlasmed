import { describe, expect, test } from "bun:test";
import { productEquivalences, products } from "@atlasmed/database";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleCompetitorProductRepository } from "./drizzle-competitor-product.repository";

/**
 * `equivalenceCount` on the competitor list, against a real Postgres.
 *
 * This exists because the first implementation was a correlated `sql` subquery
 * and it reported **0 for every row** while the database held 42 equivalences.
 * Drizzle rendered a bare `${products.id}` inside a `sql` template unqualified
 * — it only qualifies column references when the query has a join, and that one
 * had none — so `where "competitor_product_id" = "id"` resolved `"id"` against
 * `product_equivalences` rather than `products`: valid SQL, wrong question, and
 * the only symptom was every competitor product wearing "Sem produto
 * equivalente" in the admin list. No type-checker can see that.
 *
 * The rows are seeded here rather than assumed, because the test database is
 * empty of equivalences — an assertion over whatever happens to be there would
 * pass by asserting nothing, which is the failure mode this file is guarding
 * against in the first place.
 *
 * `findAll` runs on the module `db`, so it cannot see a `withRollback`
 * transaction; the seed is cleaned up in `finally` instead.
 */
const dbUp = await isDatabaseReachable();

const LINKED = "T-EQCOUNT-LINKED";
const UNLINKED = "T-EQCOUNT-UNLINKED";
const OURS = "T-EQCOUNT-OURS";

async function seedProduct(name: string, ownership: "OWN" | "COMPETITOR") {
  const [row] = await db
    .insert(products)
    .values({
      name,
      manufacturer: "T-Manufacturer",
      countryOfOrigin: "BR",
      price17: "1",
      price18: "1",
      price20: "1",
      ownership,
    })
    .returning({ id: products.id });
  return row!.id;
}

describe.skipIf(!dbUp)("competitor equivalenceCount (database)", () => {
  test("counts the equivalences of each competitor product, not of the table", async () => {
    const ids: number[] = [];
    try {
      const ours = await seedProduct(OURS, "OWN");
      const linked = await seedProduct(LINKED, "COMPETITOR");
      const unlinked = await seedProduct(UNLINKED, "COMPETITOR");
      ids.push(ours, linked, unlinked);

      await db
        .insert(productEquivalences)
        .values({ productId: ours, competitorProductId: linked });

      const repository = new DrizzleCompetitorProductRepository();
      const { competitorProducts } = await repository.findAll({
        page: 1,
        limit: 200,
        search: "T-EQCOUNT-",
      });

      const byId = new Map(competitorProducts.map((row) => [row.id, row]));
      // Both must be right. The regression collapsed every row to 0, so an
      // assertion on the linked one alone is the one that catches it; the
      // unlinked one keeps a naive "count(*) over the table" fix from passing.
      expect(byId.get(linked)?.equivalenceCount).toBe(1);
      expect(byId.get(unlinked)?.equivalenceCount).toBe(0);
      // Our own product is not a competitor and must not appear at all.
      expect(byId.has(ours)).toBe(false);
    } finally {
      if (ids.length > 0) {
        await db
          .delete(productEquivalences)
          .where(inArray(productEquivalences.productId, ids));
        await db.delete(products).where(inArray(products.id, ids));
      }
    }
  });

  test("the search filter does not change the counts", async () => {
    // The count is joined, not correlated, and a join is where a filter can
    // quietly start counting the filtered set instead of the whole one.
    const ids: number[] = [];
    try {
      const ours = await seedProduct(OURS, "OWN");
      const linked = await seedProduct(LINKED, "COMPETITOR");
      ids.push(ours, linked);
      await db
        .insert(productEquivalences)
        .values({ productId: ours, competitorProductId: linked });

      const repository = new DrizzleCompetitorProductRepository();
      const unfiltered = await repository.findAll({ page: 1, limit: 500 });
      const filtered = await repository.findAll({
        page: 1,
        limit: 500,
        search: LINKED,
      });

      const fromAll = unfiltered.competitorProducts.find((r) => r.id === linked);
      const fromSearch = filtered.competitorProducts.find((r) => r.id === linked);
      expect(fromSearch?.equivalenceCount).toBe(1);
      expect(fromAll?.equivalenceCount).toBe(1);
    } finally {
      if (ids.length > 0) {
        await db
          .delete(productEquivalences)
          .where(inArray(productEquivalences.productId, ids));
        await db.delete(products).where(inArray(products.id, ids));
      }
    }
  });

  test("a competitor product with no equivalences reports 0, not null", async () => {
    const ids: number[] = [];
    try {
      const unlinked = await seedProduct(UNLINKED, "COMPETITOR");
      ids.push(unlinked);

      const repository = new DrizzleCompetitorProductRepository();
      const { competitorProducts } = await repository.findAll({
        page: 1,
        limit: 200,
        search: UNLINKED,
      });

      // The left join produces NULL for an unmatched row; the mobile model reads
      // null as "not asked" and hides the warning the screen exists to show.
      const found = competitorProducts.find((row) => row.id === unlinked);
      expect(found?.equivalenceCount).toBe(0);
    } finally {
      if (ids.length > 0) {
        await db.delete(products).where(eq(products.id, ids[0]!));
      }
    }
  });
});
