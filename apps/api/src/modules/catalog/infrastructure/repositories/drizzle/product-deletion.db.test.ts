import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  productEquivalences,
  productPotentialDefinitions,
  productPotentialLinks,
  products,
  productVerticals,
} from "@atlasmed/database";
import { eq } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { countProductReferences } from "./product-deletion";

/**
 * The reference count behind the conditional delete (spec 0016 §6.2), against a
 * real Postgres.
 *
 * `deleteProductIfUnreferenced` itself opens its own transaction on the module
 * `db`, so it cannot run inside `withRollback` — these assertions cover the part
 * that decides the answer, which is where the rule lives. What the delete adds
 * on top is a `FOR UPDATE` on the product row and the delete itself, both of
 * which are plain SQL.
 *
 * The relations checked here are the ones a catalogue edit must never take with
 * it: `product_equivalences` cascades, and `product_potential_links` cascades,
 * so without this count a "delete" would quietly remove a rep's picker entries
 * and a metric's membership.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedProduct(tx: Tx, name: string, ownership: "OWN" | "COMPETITOR") {
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

async function seedVertical(tx: Tx, code: string) {
  const [row] = await tx
    .insert(businessVerticals)
    .values({ code, name: code })
    .returning({ id: businessVerticals.id });
  return row!.id;
}

describe.skipIf(!dbUp)("product reference counting (database)", () => {
  test("a freshly created product is referenced by nothing", async () => {
    await withRollback(async (tx) => {
      const id = await seedProduct(tx, "T-DEL-CLEAN", "OWN");

      expect(await countProductReferences(tx, id)).toEqual({});
    });
  });

  test("its own Linhas do not block deletion", async () => {
    // `product_verticals` is part of the product, not a reference to it
    // (spec 0016 §6.7), and it cascades. Counting it would make every product
    // undeletable, since a product cannot be created without a Linha.
    await withRollback(async (tx) => {
      const id = await seedProduct(tx, "T-DEL-VERTICAL", "OWN");
      const verticalId = await seedVertical(tx, "T-DEL-V1");
      await tx.insert(productVerticals).values({ productId: id, verticalId });

      expect(await countProductReferences(tx, id)).toEqual({});
    });
  });

  test("an equivalence blocks both sides of it", async () => {
    await withRollback(async (tx) => {
      const ours = await seedProduct(tx, "T-DEL-OURS", "OWN");
      const theirs = await seedProduct(tx, "T-DEL-THEIRS", "COMPETITOR");
      await tx
        .insert(productEquivalences)
        .values({ productId: ours, competitorProductId: theirs });

      // Ours is blocked because the row names it as `product_id`; theirs because
      // the same row names it as `competitor_product_id`. One query, both sides.
      expect(await countProductReferences(tx, ours)).toEqual({
        productEquivalences: 1,
      });
      expect(await countProductReferences(tx, theirs)).toEqual({
        productEquivalences: 1,
      });
    });
  });

  test("a metric link blocks deletion", async () => {
    await withRollback(async (tx) => {
      const verticalId = await seedVertical(tx, "T-DEL-V2");
      const id = await seedProduct(tx, "T-DEL-LINKED", "OWN");
      const [definition] = await tx
        .insert(productPotentialDefinitions)
        .values({ verticalId, key: "t_del_ampolas", label: "Ampolas/mês" })
        .returning({ id: productPotentialDefinitions.id });
      await tx.insert(productPotentialLinks).values({
        productId: id,
        definitionId: definition!.id,
        verticalId,
      });

      expect(await countProductReferences(tx, id)).toEqual({
        productPotentialLinks: 1,
      });
    });
  });

  test("removing the blocker makes the product deletable again", async () => {
    await withRollback(async (tx) => {
      const ours = await seedProduct(tx, "T-DEL-UNBLOCK", "OWN");
      const theirs = await seedProduct(tx, "T-DEL-UNBLOCK-C", "COMPETITOR");
      await tx
        .insert(productEquivalences)
        .values({ productId: ours, competitorProductId: theirs });
      await tx
        .delete(productEquivalences)
        .where(eq(productEquivalences.productId, ours));

      expect(await countProductReferences(tx, ours)).toEqual({});
    });
  });
});
