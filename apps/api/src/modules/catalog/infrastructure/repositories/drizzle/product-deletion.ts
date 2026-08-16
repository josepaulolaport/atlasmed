import {
  facilityProductUsage,
  orderItems,
  productEquivalences,
  productPotentialLinks,
  products,
} from "@atlasmed/database";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  ProductDeletionOutcome,
  ProductReferences,
} from "../../../application/interfaces/product.repository.interface";

type Queryable = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Everything that still points at a product, counted in one round trip.
 *
 * Both ownerships are checked with the same query even though each can only
 * have some of them — `order_items` and `product_potential_links` are ours,
 * `facility_product_usage` is theirs. A relation that cannot apply returns 0,
 * and one shape means the two delete paths cannot drift.
 *
 * `product_verticals` is deliberately **not** counted. A product's Linhas are
 * part of the product (spec 0016 §6.7), not a reference to it, and they cascade.
 */
export async function countProductReferences(
  runner: Queryable,
  productId: number
): Promise<ProductReferences> {
  const [row] = await runner
    .select({
      orderItemCount: sql<string>`(
        select count(*) from ${orderItems} where ${orderItems.productId} = ${productId}
      )`,
      usageCount: sql<string>`(
        select count(*) from ${facilityProductUsage}
        where ${facilityProductUsage.productId} = ${productId}
      )`,
      equivalenceCount: sql<string>`(
        select count(*) from ${productEquivalences}
        where ${productEquivalences.productId} = ${productId}
           or ${productEquivalences.competitorProductId} = ${productId}
      )`,
      linkCount: sql<string>`(
        select count(*) from ${productPotentialLinks}
        where ${productPotentialLinks.productId} = ${productId}
      )`,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) return {};

  const references: ProductReferences = {};
  const add = (key: keyof ProductReferences, raw: string | number) => {
    const count = Number(raw);
    if (count > 0) references[key] = count;
  };
  add("orderItems", row.orderItemCount);
  add("facilityProductUsage", row.usageCount);
  add("productEquivalences", row.equivalenceCount);
  add("productPotentialLinks", row.linkCount);
  return references;
}

/**
 * Deletes a product of the given ownership, but only while nothing references
 * it (spec 0016 §6.2).
 *
 * The row is locked with `FOR UPDATE` **before** the counts are taken. Without
 * that lock, the check and the delete are two independent statements: an order
 * item inserted between them would be counted as absent and then removed by a
 * cascade nobody chose, or the delete would fail with an opaque 23503 —
 * depending on which relation won the race. With the lock, a concurrent insert
 * blocks on the `FOR KEY SHARE` it needs on this parent row until we commit or
 * roll back.
 *
 * Reports the blocking references rather than throwing, so the caller decides
 * how to phrase the refusal.
 */
export async function deleteProductIfUnreferenced(
  productId: number,
  ownership: "OWN" | "COMPETITOR"
): Promise<ProductDeletionOutcome> {
  return db.transaction(async (tx) => {
    const scoped = and(
      eq(products.id, productId),
      eq(products.ownership, ownership)
    );

    const locked = await tx
      .select({ id: products.id })
      .from(products)
      .where(scoped)
      .for("update");
    if (!locked[0]) return { found: false };

    const references = await countProductReferences(tx, productId);
    if (Object.keys(references).length > 0) {
      return { found: true, deleted: false, references };
    }

    await tx.delete(products).where(scoped);
    return { found: true, deleted: true };
  });
}
