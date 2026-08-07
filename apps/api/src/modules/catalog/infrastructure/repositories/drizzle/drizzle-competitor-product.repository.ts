import { db } from "../../../../../infrastructure/database/db";
import { competitorProducts } from "@atlasmed/database";
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

export class DrizzleCompetitorProductRepository implements CompetitorProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ competitorProducts: CompetitorProductRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;

    const conditions = [];
    if (params.isActive !== undefined) {
      conditions.push(eq(competitorProducts.isActive, params.isActive));
    }
    if (params.search?.trim()) {
      const pattern = `%${params.search.trim()}%`;
      conditions.push(
        or(ilike(competitorProducts.name, pattern), ilike(competitorProducts.manufacturer, pattern))
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(competitorProducts)
        .where(where)
        .orderBy(asc(competitorProducts.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(competitorProducts).where(where),
    ]);

    return {
      competitorProducts: rows.map(mapCompetitorProduct),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findById(id: number): Promise<CompetitorProductRecord | null> {
    const rows = await db.select().from(competitorProducts).where(eq(competitorProducts.id, id));
    return rows[0] ? mapCompetitorProduct(rows[0]) : null;
  }

  async findAllActive(): Promise<CompetitorProductRecord[]> {
    const rows = await db
      .select()
      .from(competitorProducts)
      .where(eq(competitorProducts.isActive, true))
      .orderBy(asc(competitorProducts.name));
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
      .insert(competitorProducts)
      .values({
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
      .returning();
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
      .update(competitorProducts)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(competitorProducts.id, id))
      .returning();
    if (!row) throw new Error("Competitor product not found");
    return mapCompetitorProduct(row);
  }
}
