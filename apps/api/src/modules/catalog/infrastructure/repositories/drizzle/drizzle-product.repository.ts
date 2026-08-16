import { db } from "../../../../../infrastructure/database/db";
import {
  facilityProductUsage,
  orderItems,
  productEquivalences,
  productPotentialLinks,
  products,
  productVerticals,
} from "@atlasmed/database";
import { eq, and, asc, sql, inArray, ilike, or } from "drizzle-orm";
import type {
  CreateProductInput,
  ProductDeletionOutcome,
  ProductRecord,
  ProductReferences,
  ProductRepository,
  UpdateProductInput,
} from "../../../application/interfaces/product.repository.interface";
import {
  countProductReferences,
  deleteProductIfUnreferenced,
} from "./product-deletion";

function mapProduct(row: {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  internalClassification: string | null;
  brand: string | null;
  unit: string | null;
  barcode: string | null;
  ncm: string | null;
  anvisaRegistration: string | null;
  requiresSterilization: boolean;
  idProdutoEmultec: number | null;
  pictureUrl: string | null;
  pictureBlurhash: string | null;
  simproCode: string | null;
  brasindiceCode: string | null;
  tissCode: string | null;
  manufacturer: string;
  countryOfOrigin: string;
  price: string | null;
  price17: string;
  price18: string;
  price20: string;
  brasindiceUpdatedAt: string | null;
  metricUnits: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}, verticalIds: number[]): ProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    commercialCode: row.commercialCode,
    productGroup: row.productGroup,
    productClassification: row.productClassification,
    internalClassification: row.internalClassification,
    brand: row.brand,
    unit: row.unit,
    barcode: row.barcode,
    ncm: row.ncm,
    anvisaRegistration: row.anvisaRegistration,
    requiresSterilization: row.requiresSterilization,
    idProdutoEmultec: row.idProdutoEmultec,
    verticalIds,
    pictureUrl: row.pictureUrl,
    pictureBlurhash: row.pictureBlurhash,
    simproCode: row.simproCode,
    brasindiceCode: row.brasindiceCode,
    tissCode: row.tissCode,
    manufacturer: row.manufacturer,
    countryOfOrigin: row.countryOfOrigin,
    price: row.price === null ? null : Number(row.price),
    price17: Number(row.price17),
    price18: Number(row.price18),
    price20: Number(row.price20),
    brasindiceUpdatedAt: row.brasindiceUpdatedAt,
    metricUnits: Number(row.metricUnits),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** `numeric` columns round-trip as strings; null stays null rather than "null". */
function numericOrNull(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : String(value);
}

/**
 * Products we sell. `ownership = COMPETITOR` rows live in the same table
 * (spec 0013 §2) and must never surface through the product catalogue.
 */
const IS_OWN = eq(products.ownership, "OWN");

const productColumns = {
  id: products.id,
  code: products.code,
  name: products.name,
  description: products.description,
  commercialCode: products.commercialCode,
  productGroup: products.productGroup,
  productClassification: products.productClassification,
  internalClassification: products.internalClassification,
  brand: products.brand,
  unit: products.unit,
  barcode: products.barcode,
  ncm: products.ncm,
  anvisaRegistration: products.anvisaRegistration,
  requiresSterilization: products.requiresSterilization,
  idProdutoEmultec: products.idProdutoEmultec,
  pictureUrl: products.pictureUrl,
  pictureBlurhash: products.pictureBlurhash,
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
  metricUnits: products.metricUnits,
  isActive: products.isActive,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

async function fetchVerticalIds(productIds: number[]): Promise<Map<number, number[]>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({ productId: productVerticals.productId, verticalId: productVerticals.verticalId })
    .from(productVerticals)
    .where(inArray(productVerticals.productId, productIds));
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const existing = map.get(row.productId) ?? [];
    existing.push(row.verticalId);
    map.set(row.productId, existing);
  }
  return map;
}

export class DrizzleProductRepository implements ProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    verticalIds: number[];
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }> {
    if (params.verticalIds.length === 0) {
      return { products: [], total: 0 };
    }

    const skip = (params.page - 1) * params.limit;

    const conditions = [
      // Our catalogue only. Competitor products share this table since spec
      // 0013 §2, and would otherwise appear in the product list, the search and
      // every count derived from them.
      IS_OWN,
      inArray(
        products.id,
        db
          .select({ productId: productVerticals.productId })
          .from(productVerticals)
          .where(inArray(productVerticals.verticalId, params.verticalIds))
      ),
    ];
    if (params.isActive !== undefined) conditions.push(eq(products.isActive, params.isActive));
    if (params.search?.trim()) {
      const pattern = `%${params.search.trim()}%`;
      conditions.push(or(ilike(products.name, pattern), ilike(products.code, pattern))!);
    }
    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      db.select(productColumns).from(products).where(where).orderBy(asc(products.name)).offset(skip).limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    const productIds = rows.map((r) => r.id);
    const verticalMap = await fetchVerticalIds(productIds);

    return {
      products: rows.map((row) => mapProduct(row, verticalMap.get(row.id) ?? [])),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findById(id: number): Promise<ProductRecord | null> {
    const rows = await db
      .select(productColumns)
      .from(products)
      .where(and(eq(products.id, id), IS_OWN));
    if (!rows[0]) return null;
    const verticalMap = await fetchVerticalIds([id]);
    return mapProduct(rows[0], verticalMap.get(id) ?? []);
  }

  async findAllActive(params: { verticalIds: number[] }): Promise<ProductRecord[]> {
    if (params.verticalIds.length === 0) return [];

    const rows = await db
      .select(productColumns)
      .from(products)
      .where(
        and(
          IS_OWN,
          eq(products.isActive, true),
          inArray(
            products.id,
            db
              .select({ productId: productVerticals.productId })
              .from(productVerticals)
              .where(inArray(productVerticals.verticalId, params.verticalIds))
          )
        )
      )
      .orderBy(asc(products.name));
    const verticalMap = await fetchVerticalIds(rows.map((r) => r.id));
    return rows.map((row) => mapProduct(row, verticalMap.get(row.id) ?? []));
  }

  async create(data: CreateProductInput): Promise<ProductRecord> {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          code: data.code ?? null,
          name: data.name,
          description: data.description ?? null,
          commercialCode: data.commercialCode ?? null,
          productGroup: data.productGroup ?? null,
          productClassification: data.productClassification ?? null,
          internalClassification: data.internalClassification ?? null,
          brand: data.brand ?? null,
          unit: data.unit ?? null,
          barcode: data.barcode ?? null,
          ncm: data.ncm ?? null,
          anvisaRegistration: data.anvisaRegistration ?? null,
          requiresSterilization: data.requiresSterilization ?? false,
          idProdutoEmultec: data.idProdutoEmultec ?? null,
          simproCode: data.simproCode ?? null,
          brasindiceCode: data.brasindiceCode ?? null,
          tissCode: data.tissCode ?? null,
          manufacturer: data.manufacturer,
          countryOfOrigin: data.countryOfOrigin,
          // `String(null)` is `"null"`, which Postgres rejects as numeric — and
          // `price` is null for every product spec 0013 §2 allows without one.
          price: numericOrNull(data.price ?? null) ?? null,
          price17: String(data.price17 ?? 0),
          price18: String(data.price18 ?? 0),
          price20: String(data.price20 ?? 0),
          brasindiceUpdatedAt: data.brasindiceUpdatedAt ?? null,
          // `metricUnits` is deliberately not set: it keeps its `0082` default
          // of 1 and has no writer (spec 0016 §7.1).
          isActive: data.isActive ?? true,
        })
        .returning(productColumns);
      if (!product) throw new Error("Failed to insert product");

      const uniqueVerticalIds = [...new Set(data.verticalIds)];
      if (uniqueVerticalIds.length > 0) {
        await tx.insert(productVerticals).values(
          uniqueVerticalIds.map((verticalId) => ({ productId: product.id, verticalId }))
        );
      }
      return mapProduct(product, uniqueVerticalIds);
    });
  }

  /**
   * Updates the writable columns. **Linhas are not among them** — spec 0016
   * §6.7 fixes a product's `product_verticals` at creation, because orders key
   * on `facility_vertical_profile_id` and `product_potential_links` is unique
   * per (product, vertical), so re-verticalising a product with history changes
   * which profiles its sales join to and orphans its metric link.
   */
  async update(id: number, data: UpdateProductInput): Promise<ProductRecord> {
    const { price, price17, price18, price20, ...rest } = data;
    const productData: Record<string, unknown> = { ...rest };
    if (price !== undefined) productData.price = numericOrNull(price);
    if (price17 !== undefined) productData.price17 = String(price17);
    if (price18 !== undefined) productData.price18 = String(price18);
    if (price20 !== undefined) productData.price20 = String(price20);

    // `undefined` means "not sent"; an explicit `null` means "clear it", which
    // is the whole point of the nullable codes in spec 0013 §2 — so only
    // `undefined` is filtered out here.
    const cleanData = Object.fromEntries(
      Object.entries(productData).filter(([, v]) => v !== undefined)
    );

    return db.transaction(async (tx) => {
      // Scoped like every read in this repository. Without `IS_OWN` the product
      // endpoint could edit a competitor's row — the reads were scoped when
      // competitor products merged into this table (#226) and the writes were
      // not, so `PUT /products/:id` reached rows the same repository refused to
      // return.
      const [product] = await tx
        .update(products)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(products.id, id), IS_OWN))
        .returning(productColumns);
      if (!product) throw new Error("Product not found");

      const verticalMap = await fetchVerticalIds([id]);
      return mapProduct(product, verticalMap.get(id) ?? []);
    });
  }

  async updatePicture(
    id: number,
    picture: { pictureUrl: string | null; pictureBlurhash: string | null }
  ): Promise<void> {
    // `IS_OWN` for the same reason as `update`: this repository is the products
    // side, and a competitor's picture is the competitor repository's business.
    await db
      .update(products)
      .set({ ...picture, updatedAt: new Date() })
      .where(and(eq(products.id, id), IS_OWN));
  }

  async findReferences(id: number): Promise<ProductReferences> {
    return countProductReferences(db, id);
  }

  async deleteIfUnreferenced(id: number): Promise<ProductDeletionOutcome> {
    return deleteProductIfUnreferenced(id, "OWN");
  }
}
