import { db } from "../../../../../infrastructure/database/db";
import { products, productSectors } from "@atlasmed/database";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import type {
  ProductRecord,
  ProductRepository,
} from "../../../application/interfaces/product.repository.interface";

function mapProduct(row: {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}, sectorIds: string[]): ProductRecord {
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

const productColumns = {
  id: products.id,
  code: products.code,
  name: products.name,
  isActive: products.isActive,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

async function fetchSectorIds(productIds: string[]): Promise<Map<string, string[]>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({ productId: productSectors.productId, sectorId: productSectors.sectorId })
    .from(productSectors)
    .where(inArray(productSectors.productId, productIds));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.productId) ?? [];
    existing.push(row.sectorId);
    map.set(row.productId, existing);
  }
  return map;
}

export class DrizzleProductRepository implements ProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    sectorId?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;

    const conditions = [];
    if (params.isActive !== undefined) conditions.push(eq(products.isActive, params.isActive));
    if (params.sectorId) {
      conditions.push(
        inArray(
          products.id,
          db.select({ productId: productSectors.productId })
            .from(productSectors)
            .where(eq(productSectors.sectorId, params.sectorId))
        )
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select(productColumns).from(products).where(where).orderBy(asc(products.name)).offset(skip).limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    const productIds = rows.map((r) => r.id);
    const sectorMap = await fetchSectorIds(productIds);

    return {
      products: rows.map((row) => mapProduct(row, sectorMap.get(row.id) ?? [])),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const rows = await db.select(productColumns).from(products).where(eq(products.id, id));
    if (!rows[0]) return null;
    const sectorMap = await fetchSectorIds([id]);
    return mapProduct(rows[0], sectorMap.get(id) ?? []);
  }

  async create(data: {
    code: string;
    name: string;
    sectorIds: string[];
    isActive?: boolean;
  }): Promise<ProductRecord> {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          code: data.code,
          name: data.name,
          isActive: data.isActive ?? true,
        })
        .returning(productColumns);
      if (!product) throw new Error("Failed to insert product");

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
    const { sectorIds, ...productData } = data;
    const cleanData = Object.fromEntries(
      Object.entries(productData).filter(([, v]) => v !== undefined)
    );

    return db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
// Only set updatedAt when product data actually changes
const hasProductChanges = Object.keys(cleanData).length > 0;
const setData = hasProductChanges
  ? { ...cleanData, updatedAt: new Date() }
  : cleanData;

const [product] = await tx
  .update(products)
  .set(setData)
  .where(eq(products.id, id))
  .returning(productColumns);
        .where(eq(products.id, id))
        .returning(productColumns);
      if (!product) throw new Error("Product not found");

      if (sectorIds !== undefined) {
        const uniqueSectorIds = [...new Set(sectorIds)];
        await tx.delete(productSectors).where(eq(productSectors.productId, id));
        if (uniqueSectorIds.length > 0) {
          await tx.insert(productSectors).values(
            uniqueSectorIds.map((sectorId) => ({ productId: id, sectorId }))
          );
        }
        return mapProduct(product, uniqueSectorIds);
      }

      const sectorMap = await fetchSectorIds([id]);
      return mapProduct(product, sectorMap.get(id) ?? []);
    });
  }
}
