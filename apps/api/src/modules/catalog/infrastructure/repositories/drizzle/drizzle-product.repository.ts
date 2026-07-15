import { db } from "../../../../../infrastructure/database/db";
import { products, productSectors } from "@atlasmed/database";
import { eq, and, asc, sql, inArray, ilike, or } from "drizzle-orm";
import type {
  ProductRecord,
  ProductRepository,
} from "../../../application/interfaces/product.repository.interface";

function mapProduct(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  brand: string | null;
  unit: string | null;
  pictureUrl: string | null;
  simproCode: string;
  brasindiceCode: string;
  tissCode: string;
  manufacturer: string;
  countryOfOrigin: string;
  price: string;
  price17: string;
  price18: string;
  price20: string;
  brasindiceUpdatedAt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}, sectorIds: string[]): ProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    commercialCode: row.commercialCode,
    productGroup: row.productGroup,
    productClassification: row.productClassification,
    brand: row.brand,
    unit: row.unit,
    sectorIds,
    pictureUrl: row.pictureUrl,
    simproCode: row.simproCode,
    brasindiceCode: row.brasindiceCode,
    tissCode: row.tissCode,
    manufacturer: row.manufacturer,
    countryOfOrigin: row.countryOfOrigin,
    price: Number(row.price),
    price17: Number(row.price17),
    price18: Number(row.price18),
    price20: Number(row.price20),
    brasindiceUpdatedAt: row.brasindiceUpdatedAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const productColumns = {
  id: products.id,
  code: products.code,
  name: products.name,
  description: products.description,
  commercialCode: products.commercialCode,
  productGroup: products.productGroup,
  productClassification: products.productClassification,
  brand: products.brand,
  unit: products.unit,
  pictureUrl: products.pictureUrl,
  simproCode: products.simproCode,
  brasindiceCode: products.brasindiceCode,
  tissCode: products.tissCode,
  manufacturer: products.manufacturer,
  countryOfOrigin: products.countryOfOrigin,
  price: products.price,
  price17: products.price17,
  price18: products.price18,
  price20: products.price20,
  brasindiceUpdatedAt: products.brasindiceUpdatedAt,
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
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;

    const conditions = [];
    if (params.isActive !== undefined) conditions.push(eq(products.isActive, params.isActive));
    if (params.search?.trim()) {
      const pattern = `%${params.search.trim()}%`;
      conditions.push(or(ilike(products.name, pattern), ilike(products.code, pattern)));
    }
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
    pictureUrl?: string | null;
    simproCode: string;
    brasindiceCode: string;
    tissCode: string;
    manufacturer: string;
    countryOfOrigin: string;
    price: number;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string;
    isActive?: boolean;
  }): Promise<ProductRecord> {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          code: data.code,
          name: data.name,
          pictureUrl: data.pictureUrl ?? null,
          simproCode: data.simproCode,
          brasindiceCode: data.brasindiceCode,
          tissCode: data.tissCode,
          manufacturer: data.manufacturer,
          countryOfOrigin: data.countryOfOrigin,
          price: String(data.price),
          price17: String(data.price17),
          price18: String(data.price18),
          price20: String(data.price20),
          brasindiceUpdatedAt: data.brasindiceUpdatedAt,
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
    data: {
      code?: string;
      name?: string;
      sectorIds?: string[];
      pictureUrl?: string | null;
      simproCode?: string;
      brasindiceCode?: string;
      tissCode?: string;
      manufacturer?: string;
      countryOfOrigin?: string;
      price?: number;
      price17?: number;
      price18?: number;
      price20?: number;
      brasindiceUpdatedAt?: string;
      isActive?: boolean;
    }
  ): Promise<ProductRecord> {
    const { sectorIds, price, price17, price18, price20, ...rest } = data;
    const productData: Record<string, unknown> = { ...rest };
    if (price !== undefined) productData.price = String(price);
    if (price17 !== undefined) productData.price17 = String(price17);
    if (price18 !== undefined) productData.price18 = String(price18);
    if (price20 !== undefined) productData.price20 = String(price20);

    const cleanData = Object.fromEntries(
      Object.entries(productData).filter(([, v]) => v !== undefined)
    );

    return db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
        .set({ ...cleanData, updatedAt: new Date() })
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
