import { db } from "../../../../../infrastructure/database/db";
import { products, productSectors } from "@atlasmed/database";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import type {
  ProductRecord,
  ProductRepository,
} from "../../../application/interfaces/product.repository.interface";

async function loadSectorIds(productIds: string[]): Promise<Map<string, string[]>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({ productId: productSectors.productId, sectorId: productSectors.sectorId })
    .from(productSectors)
    .where(inArray(productSectors.productId, productIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row.sectorId);
    map.set(row.productId, list);
  }
  return map;
}

function mapProduct(
  row: { id: string; code: string; name: string; isActive: boolean; createdAt: Date; updatedAt: Date },
  sectorIds: string[]
): ProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sectorIds,
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
    const skip = (params.page - 1) * params.limit;

    // When filtering by sector, scope to products that have that sector assigned
    if (params.sectorId) {
      const matchingProductIds = await db
        .select({ productId: productSectors.productId })
        .from(productSectors)
        .where(eq(productSectors.sectorId, params.sectorId));

      const ids = matchingProductIds.map((r) => r.productId);
      if (ids.length === 0) return { products: [], total: 0 };

      const activeCondition = params.isActive !== undefined
        ? eq(products.isActive, params.isActive)
        : undefined;
      const where = and(inArray(products.id, ids), activeCondition);

      const [rows, countRows] = await Promise.all([
        db.select().from(products).where(where).orderBy(asc(products.name)).offset(skip).limit(params.limit),
        db.select({ count: sql<number>`count(*)` }).from(products).where(where),
      ]);

      const sectorMap = await loadSectorIds(rows.map((r) => r.id));
      return {
        products: rows.map((r) => mapProduct(r, sectorMap.get(r.id) ?? [])),
        total: Number(countRows[0]?.count ?? 0),
      };
    }

    const where = params.isActive !== undefined ? eq(products.isActive, params.isActive) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select().from(products).where(where).orderBy(asc(products.name)).offset(skip).limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    const sectorMap = await loadSectorIds(rows.map((r) => r.id));
    return {
      products: rows.map((r) => mapProduct(r, sectorMap.get(r.id) ?? [])),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const rows = await db.select().from(products).where(eq(products.id, id));
    if (!rows[0]) return null;
    const sectorMap = await loadSectorIds([id]);
    return mapProduct(rows[0], sectorMap.get(id) ?? []);
  }

  async create(data: { code: string; name: string; sectorIds: string[]; isActive?: boolean }): Promise<ProductRecord> {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({ code: data.code, name: data.name, isActive: data.isActive ?? true })
        .returning();

      if (!product) {
        throw new Error("Failed to create product: no row returned");
      }

      const uniqueSectorIds = [...new Set(data.sectorIds)];
      if (uniqueSectorIds.length > 0) {
        await tx.insert(productSectors).values(
          uniqueSectorIds.map((sectorId) => ({ productId: product.id, sectorId }))
        );
      }

      return mapProduct(product, uniqueSectorIds);
    });
  }

  async update(
    id: string,
    data: { code?: string; name?: string; sectorIds?: string[]; isActive?: boolean }
  ): Promise<ProductRecord> {
    return db.transaction(async (tx) => {
      const { sectorIds, ...fields } = data;

      const [product] = await tx
        .update(products)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (!product) {
        throw new Error(`Product with id "${id}" not found`);
      }

      if (sectorIds !== undefined) {
        await tx.delete(productSectors).where(eq(productSectors.productId, id));
        const uniqueSectorIds = [...new Set(sectorIds)];
        if (uniqueSectorIds.length > 0) {
          await tx.insert(productSectors).values(
            uniqueSectorIds.map((sectorId) => ({ productId: id, sectorId }))
          );
        }
      }

      const finalSectorIds = sectorIds !== undefined
        ? [...new Set(sectorIds)]
        : (await loadSectorIds([id])).get(id) ?? [];
      return mapProduct(product, finalSectorIds);
    });
  }
}
