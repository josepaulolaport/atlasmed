import { db } from "../../../../../infrastructure/database/db";
import { products, productEquivalences } from "@atlasmed/database";
import { eq, and, asc, notInArray } from "drizzle-orm";
import type { ProductEquivalenceRepository } from "../../../application/interfaces/product-equivalence.repository.interface";
import type { CompetitorProductRecord } from "../../../application/interfaces/competitor-product.repository.interface";

function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function mapCompetitorProduct(row: {
  id: number;
  code: string | null;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  countryOfOrigin: string | null;
  price17: string | null;
  price18: string | null;
  price20: string | null;
  brasindiceUpdatedAt: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CompetitorProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    countryOfOrigin: row.countryOfOrigin,
    price17: toNumberOrNull(row.price17),
    price18: toNumberOrNull(row.price18),
    price20: toNumberOrNull(row.price20),
    brasindiceUpdatedAt: row.brasindiceUpdatedAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProductEquivalenceRepository implements ProductEquivalenceRepository {
  async findLinkedByProduct(productId: number): Promise<CompetitorProductRecord[]> {
    const rows = await db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        manufacturer: products.manufacturer,
        brand: products.brand,
        countryOfOrigin: products.countryOfOrigin,
        price17: products.price17,
        price18: products.price18,
        price20: products.price20,
        brasindiceUpdatedAt: products.brasindiceUpdatedAt,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(productEquivalences)
      .innerJoin(products, eq(productEquivalences.competitorProductId, products.id))
      .where(eq(productEquivalences.productId, productId))
      .orderBy(asc(products.name));
    return rows.map(mapCompetitorProduct);
  }

  async findUnlinkedByProduct(productId: number): Promise<CompetitorProductRecord[]> {
    const linked = db
      .select({ competitorProductId: productEquivalences.competitorProductId })
      .from(productEquivalences)
      .where(eq(productEquivalences.productId, productId));

    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          // Without this the picker would offer our own products as competitors
          // — they live in the same table since spec 0013 §2.
          eq(products.ownership, "COMPETITOR"),
          eq(products.isActive, true),
          notInArray(products.id, linked)
        )
      )
      .orderBy(asc(products.name));
    return rows.map(mapCompetitorProduct);
  }

  async exists(productId: number, competitorProductId: number): Promise<boolean> {
    const rows = await db
      .select({ id: productEquivalences.id })
      .from(productEquivalences)
      .where(
        and(
          eq(productEquivalences.productId, productId),
          eq(productEquivalences.competitorProductId, competitorProductId)
        )
      );
    return rows.length > 0;
  }

  async link(productId: number, competitorProductId: number, notes?: string | null): Promise<void> {
    await db.insert(productEquivalences).values({
      productId,
      competitorProductId,
      notes: notes ?? null,
    });
  }

  async unlink(productId: number, competitorProductId: number): Promise<boolean> {
    const deleted = await db
      .delete(productEquivalences)
      .where(
        and(
          eq(productEquivalences.productId, productId),
          eq(productEquivalences.competitorProductId, competitorProductId)
        )
      )
      .returning({ id: productEquivalences.id });
    return deleted.length > 0;
  }
}
