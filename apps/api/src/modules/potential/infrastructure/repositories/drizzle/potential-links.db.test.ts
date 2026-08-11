import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  productPotentialDefinitions,
  productPotentialLinks,
  products,
} from "@atlasmed/database";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * Metric links, against a real Postgres (spec 0013 §3).
 *
 * `product_potential_links.product_id` used to be the primary key, which
 * contradicted `product_verticals` being many-to-many: a product sold in two
 * linhas carried a metric in one and, silently, none in the other. Migration
 * 0086 re-keys the link and pins its vertical to the definition's own.
 *
 * These assert the schema, not a use case, because that is where the rule now
 * lives — a repair script or a future code path bypasses the use case but not
 * the constraint.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedVertical(tx: Tx, code: string) {
  const [row] = await tx
    .insert(businessVerticals)
    .values({ code, name: code })
    .returning({ id: businessVerticals.id });
  return row!.id;
}

async function seedDefinition(tx: Tx, verticalId: number, key: string) {
  const [row] = await tx
    .insert(productPotentialDefinitions)
    .values({ verticalId, key, label: key })
    .returning({ id: productPotentialDefinitions.id });
  return row!.id;
}

async function seedProduct(tx: Tx, name: string, metricUnits = "1") {
  const [row] = await tx
    .insert(products)
    .values({
      name,
      manufacturer: "T-Manufacturer",
      countryOfOrigin: "BR",
      price17: "1",
      price18: "1",
      price20: "1",
      metricUnits,
      ownership: "OWN",
    })
    .returning({ id: products.id });
  return row!.id;
}

async function sqlStateOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return (error as { cause?: { code?: string } }).cause?.code;
  }
}

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

describe.skipIf(!dbUp)("product potential links (database)", () => {
  test("one product carries a metric in each linha it sells into", async () => {
    await withRollback(async (tx) => {
      const orto = await seedVertical(tx, "T-LINK-ORTO");
      const derma = await seedVertical(tx, "T-LINK-DERMA");
      const ampolas = await seedDefinition(tx, orto, "t-link-ampolas");
      const seringas = await seedDefinition(tx, derma, "t-link-seringas");
      const productId = await seedProduct(tx, "T-LINK-BOTH");

      const rows = await tx
        .insert(productPotentialLinks)
        .values([
          { productId, definitionId: ampolas, verticalId: orto },
          { productId, definitionId: seringas, verticalId: derma },
        ])
        .returning({ definitionId: productPotentialLinks.definitionId });

      // The whole point of 0086: this was impossible under a product_id PK.
      expect(rows.map((r) => r.definitionId).sort()).toEqual(
        [ampolas, seringas].sort()
      );
    });
  });

  test("a product cannot hold two metrics in the same linha", async () => {
    await withRollback(async (tx) => {
      const orto = await seedVertical(tx, "T-LINK-DUP");
      const first = await seedDefinition(tx, orto, "t-link-dup-a");
      const second = await seedDefinition(tx, orto, "t-link-dup-b");
      const productId = await seedProduct(tx, "T-LINK-DUP-PRODUCT");

      await tx
        .insert(productPotentialLinks)
        .values({ productId, definitionId: first, verticalId: orto });

      // Otherwise the penetration join counts the product's sales twice.
      const code = await sqlStateOf(() =>
        tx
          .insert(productPotentialLinks)
          .values({ productId, definitionId: second, verticalId: orto })
      );

      expect(code).toBe(UNIQUE_VIOLATION);
    });
  });

  test("a link cannot claim a linha its definition does not have", async () => {
    await withRollback(async (tx) => {
      const owning = await seedVertical(tx, "T-LINK-OWN");
      const other = await seedVertical(tx, "T-LINK-OTHER");
      const definitionId = await seedDefinition(tx, owning, "t-link-mismatch");
      const productId = await seedProduct(tx, "T-LINK-MISMATCH-PRODUCT");

      // `vertical_id` is denormalised for the uniqueness rule, so nothing may
      // let it drift from the definition it points at.
      const code = await sqlStateOf(() =>
        tx
          .insert(productPotentialLinks)
          .values({ productId, definitionId, verticalId: other })
      );

      expect(code).toBe(FOREIGN_KEY_VIOLATION);
    });
  });
});
