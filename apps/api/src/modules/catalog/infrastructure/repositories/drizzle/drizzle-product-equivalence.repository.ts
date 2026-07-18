import { db } from "../../../../../infrastructure/database/db";
import { competitorProducts, productEquivalences } from "@atlasmed/database";
import { eq, and, asc, notInArray } from "drizzle-orm";
import type { ProductEquivalenceRepository } from "../../../application/interfaces/product-equivalence.repository.interface";
import type { CompetitorProductRecord } from "../../../application/interfaces/competitor-product.repository.interface";

function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function mapCompetitorProduct(row: {
  id: string;
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
  async findLinkedByProduct(productId: string): Promise<CompetitorProductRecord[]> {
    const rows = await db
      .select({
        id: competitorProducts.id,
        code: competitorProducts.code,
        name: competitorProducts.name,
        manufacturer: competitorProducts.manufacturer,
        brand: competitorProducts.brand,
        countryOfOrigin: competitorProducts.countryOfOrigin,
        price17: competitorProducts.price17,
        price18: competitorProducts.price18,
        price20: competitorProducts.price20,
        brasindiceUpdatedAt: competitorProducts.brasindiceUpdatedAt,
        isActive: competitorProducts.isActive,
        createdAt: competitorProducts.createdAt,
        updatedAt: competitorProducts.updatedAt,
      })
      .from(productEquivalences)
      .innerJoin(competitorProducts, eq(productEquivalences.competitorProductId, competitorProducts.id))
      .where(eq(productEquivalences.productId, productId))
      .orderBy(asc(competitorProducts.name));
    return rows.map(mapCompetitorProduct);
  }

  async findUnlinkedByProduct(productId: string): Promise<CompetitorProductRecord[]> {
    const linked = db
      .select({ competitorProductId: productEquivalences.competitorProductId })
      .from(productEquivalences)
      .where(eq(productEquivalences.productId, productId));

    const rows = await db
      .select()
      .from(competitorProducts)
      .where(
        and(eq(competitorProducts.isActive, true), notInArray(competitorProducts.id, linked))
      )
      .orderBy(asc(competitorProducts.name));
    return rows.map(mapCompetitorProduct);
  }

  async exists(productId: string, competitorProductId: string): Promise<boolean> {
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

  async link(productId: string, competitorProductId: string, notes?: string | null): Promise<void> {
    await db.insert(productEquivalences).values({
      productId,
      competitorProductId,
      notes: notes ?? null,
    });
  }

  async unlink(productId: string, competitorProductId: string): Promise<boolean> {
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
