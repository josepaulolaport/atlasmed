import { db } from "../../../../../infrastructure/database/db";
import { products } from "@atlasmed/database";
import { eq, and, asc, sql } from "drizzle-orm";
import type {
  ProductRecord,
  ProductRepository,
} from "../../../application/interfaces/product.repository.interface";

function mapProduct(row: {
  id: string;
  code: string;
  name: string;
  sectorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sectorId: row.sectorId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProductRepository implements ProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    sectorId?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }> {
    const conditions = [
      ...(params.sectorId ? [eq(products.sectorId, params.sectorId)] : []),
      ...(params.isActive !== undefined ? [eq(products.isActive, params.isActive)] : []),
    ];
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const skip = (params.page - 1) * params.limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(products)
        .where(where)
        .orderBy(asc(products.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    return { products: rows.map(mapProduct), total: Number(count) };
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const rows = await db.select().from(products).where(eq(products.id, id));
    return rows[0] ? mapProduct(rows[0]) : null;
  }

  async create(data: {
    code: string;
    name: string;
    sectorId: string;
    isActive?: boolean;
  }): Promise<ProductRecord> {
    const [product] = await db
      .insert(products)
      .values({
        code: data.code,
        name: data.name,
        sectorId: data.sectorId,
        isActive: data.isActive ?? true,
      })
      .returning();
    return mapProduct(product);
  }

  async update(
    id: string,
    data: { code?: string; name?: string; sectorId?: string; isActive?: boolean }
  ): Promise<ProductRecord> {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return mapProduct(product);
  }
}
