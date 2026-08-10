import { db } from "../../../../../infrastructure/database/db";
import { products } from "@atlasmed/database";
import { eq, and, asc, sql, ilike, or } from "drizzle-orm";
import type {
  CompetitorProductRecord,
  CompetitorProductRepository,
} from "../../../application/interfaces/competitor-product.repository.interface";

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

/**
 * Competitor products are `products` rows with `ownership = COMPETITOR`
 * (spec 0013 §2). "Competitor" is a statement about our commercial relationship
 * to a product, not a kind of product, so it is a column rather than a table.
 *
 * Every query below carries this predicate. Without it on a *read*, our own
 * catalogue leaks into the competitor list; without it on `findById` or
 * `update`, the competitor endpoints become an unguarded way to read and edit
 * our own products by id.
 */
const IS_COMPETITOR = eq(products.ownership, "COMPETITOR");

/** The subset the competitor contract exposes; `products` has more. */
const competitorColumns = {
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
};

export class DrizzleCompetitorProductRepository implements CompetitorProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ competitorProducts: CompetitorProductRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;

    const conditions = [IS_COMPETITOR];
    if (params.isActive !== undefined) {
      conditions.push(eq(products.isActive, params.isActive));
    }
    if (params.search?.trim()) {
      const pattern = `%${params.search.trim()}%`;
      conditions.push(
        or(ilike(products.name, pattern), ilike(products.manufacturer, pattern))!
      );
    }
    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      db
        .select(competitorColumns)
        .from(products)
        .where(where)
        .orderBy(asc(products.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    return {
      competitorProducts: rows.map(mapCompetitorProduct),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findById(id: number): Promise<CompetitorProductRecord | null> {
    const rows = await db
      .select(competitorColumns)
      .from(products)
      .where(and(eq(products.id, id), IS_COMPETITOR));
    return rows[0] ? mapCompetitorProduct(rows[0]) : null;
  }

  async findAllActive(): Promise<CompetitorProductRecord[]> {
    const rows = await db
      .select(competitorColumns)
      .from(products)
      .where(and(IS_COMPETITOR, eq(products.isActive, true)))
      .orderBy(asc(products.name));
    return rows.map(mapCompetitorProduct);
  }

  async create(data: {
    code?: string | null;
    name: string;
    manufacturer: string;
    brand?: string | null;
    countryOfOrigin: string;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string;
    isActive?: boolean;
  }): Promise<CompetitorProductRecord> {
    const [row] = await db
      .insert(products)
      .values({
        ownership: "COMPETITOR",
        code: data.code ?? null,
        name: data.name,
        manufacturer: data.manufacturer,
        brand: data.brand ?? null,
        countryOfOrigin: data.countryOfOrigin,
        price17: String(data.price17),
        price18: String(data.price18),
        price20: String(data.price20),
        brasindiceUpdatedAt: data.brasindiceUpdatedAt,
        isActive: data.isActive ?? true,
      })
      .returning(competitorColumns);
    return mapCompetitorProduct(row!);
  }

  async update(
    id: number,
    data: {
      code?: string | null;
      name?: string;
      manufacturer?: string;
      brand?: string | null;
      countryOfOrigin?: string;
      price17?: number;
      price18?: number;
      price20?: number;
      brasindiceUpdatedAt?: string;
      isActive?: boolean;
    }
  ): Promise<CompetitorProductRecord> {
    const { price17, price18, price20, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (price17 !== undefined) updateData.price17 = String(price17);
    if (price18 !== undefined) updateData.price18 = String(price18);
    if (price20 !== undefined) updateData.price20 = String(price20);

    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    );

    const [row] = await db
      .update(products)
      .set({ ...cleanData, updatedAt: new Date() })
      // Scoped: this endpoint must not be able to edit one of our own products.
      .where(and(eq(products.id, id), IS_COMPETITOR))
      .returning(competitorColumns);
    if (!row) throw new Error("Competitor product not found");
    return mapCompetitorProduct(row);
  }
}
