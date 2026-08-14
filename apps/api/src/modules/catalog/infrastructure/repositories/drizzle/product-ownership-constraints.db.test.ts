import { describe, expect, test } from "bun:test";
import { productEquivalences, products } from "@atlasmed/database";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * Ownership as a database constraint (spec 0013 §2.1), against a real Postgres.
 *
 * When competitor products lived in their own table, "an equivalence links one
 * of ours to one of theirs" was guaranteed by which table each foreign key
 * pointed at. Merging them into `products` removed that guarantee and left it
 * as prose — `REFERENCES products(id)` accepts either kind — so for a while the
 * only thing stopping a product being its own competitor was that the use case
 * happened to look the two ids up through differently scoped repositories.
 *
 * These assertions are about the schema, not the use case, and are written at
 * the level where the rule now lives. Each is a row the database must refuse.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedProduct(
  tx: Tx,
  name: string,
  ownership: "OWN" | "COMPETITOR"
) {
  const [row] = await tx
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

/** The SQLSTATE, not the message — drizzle rewraps driver errors. */
async function sqlStateOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return (error as { cause?: { code?: string } }).cause?.code;
  }
}

const UNIQUE_OR_CHECK_VIOLATION = "23514"; // check_violation
const FOREIGN_KEY_VIOLATION = "23503";

describe.skipIf(!dbUp)("product ownership constraints (database)", () => {
  test("a product cannot be its own competitor", async () => {
    await withRollback(async (tx) => {
      const ours = await seedProduct(tx, "T-OWN-SELF", "OWN");

      const code = await sqlStateOf(() =>
        tx.insert(productEquivalences).values({
          productId: ours,
          competitorProductId: ours,
        })
      );

      expect(code).toBe(UNIQUE_OR_CHECK_VIOLATION);
    });
  });

  // One violating write per transaction: a failed statement puts Postgres in
  // "current transaction is aborted" (25P02), so a second attempt in the same
  // transaction reports that instead of the constraint being tested.
  test("the right side cannot be one of ours", async () => {
    await withRollback(async (tx) => {
      const ourA = await seedProduct(tx, "T-OWN-A", "OWN");
      const ourB = await seedProduct(tx, "T-OWN-B", "OWN");

      const code = await sqlStateOf(() =>
        tx.insert(productEquivalences).values({
          productId: ourA,
          competitorProductId: ourB,
        })
      );

      expect(code).toBe(FOREIGN_KEY_VIOLATION);
    });
  });

  test("the left side cannot be one of theirs", async () => {
    await withRollback(async (tx) => {
      const theirA = await seedProduct(tx, "T-COMP-A", "COMPETITOR");
      const theirB = await seedProduct(tx, "T-COMP-B", "COMPETITOR");

      const code = await sqlStateOf(() =>
        tx.insert(productEquivalences).values({
          productId: theirA,
          competitorProductId: theirB,
        })
      );

      expect(code).toBe(FOREIGN_KEY_VIOLATION);
    });
  });

  test("a genuine pairing is accepted", async () => {
    await withRollback(async (tx) => {
      const ours = await seedProduct(tx, "T-OWN-OK", "OWN");
      const theirs = await seedProduct(tx, "T-COMP-OK", "COMPETITOR");

      const [row] = await tx
        .insert(productEquivalences)
        .values({ productId: ours, competitorProductId: theirs })
        .returning({ id: productEquivalences.id });

      expect(row!.id).toBeGreaterThan(0);
    });
  });
});
