import { and, eq, inArray } from "drizzle-orm";
import {
  businessVerticals,
  productVerticals,
  products,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import {
  mapEmultecProductToCrm,
  type EmultecProductRow,
  type MappedCrmProduct,
} from "./map-emultec-product";

const ORTOPEDIA_CODE = "ORTOPEDIA";

export type UpsertEmultecProductsResult = {
  upserted: number;
  verticalLinks: number;
  productIdsByEmultecId: Record<number, number>;
};

async function resolveOrtopediaVerticalId(): Promise<number> {
  const [row] = await db
    .select({ id: businessVerticals.id })
    .from(businessVerticals)
    .where(eq(businessVerticals.code, ORTOPEDIA_CODE))
    .limit(1);
  if (!row) {
    throw new Error(`business_verticals.code=${ORTOPEDIA_CODE} not found`);
  }
  return row.id;
}

export async function upsertEmultecProducts(
  sourceRows: EmultecProductRow[]
): Promise<UpsertEmultecProductsResult> {
  if (sourceRows.length === 0) {
    return { upserted: 0, verticalLinks: 0, productIdsByEmultecId: {} };
  }

  const verticalId = await resolveOrtopediaVerticalId();
  const mapped = sourceRows.map(mapEmultecProductToCrm);
  const emultecIds = mapped.map((row) => row.idProdutoEmultec);

  const existing = await db
    .select({
      id: products.id,
      idProdutoEmultec: products.idProdutoEmultec,
    })
    .from(products)
    .where(inArray(products.idProdutoEmultec, emultecIds));

  const existingByEmultec = new Map(
    existing
      .filter((row) => row.idProdutoEmultec != null)
      .map((row) => [row.idProdutoEmultec as number, row.id])
  );

  const productIdsByEmultecId: Record<number, number> = {};
  let upserted = 0;

  for (const row of mapped) {
    const existingId = existingByEmultec.get(row.idProdutoEmultec);
    if (existingId != null) {
      await db
        .update(products)
        .set({
          name: row.name,
          description: row.description,
          barcode: row.barcode,
          commercialCode: row.commercialCode,
          productGroup: row.productGroup,
          brand: row.brand,
          productClassification: row.productClassification,
          manufacturer: row.manufacturer,
          isActive: true,
        })
        .where(eq(products.id, existingId));
      productIdsByEmultecId[row.idProdutoEmultec] = existingId;
    } else {
      const insertedId = await insertProductAvoidingCodeClash(row);
      productIdsByEmultecId[row.idProdutoEmultec] = insertedId;
      existingByEmultec.set(row.idProdutoEmultec, insertedId);
    }
    upserted += 1;
  }

  let verticalLinks = 0;
  for (const productId of Object.values(productIdsByEmultecId)) {
    const [link] = await db
      .select({ id: productVerticals.id })
      .from(productVerticals)
      .where(
        and(
          eq(productVerticals.productId, productId),
          eq(productVerticals.verticalId, verticalId)
        )
      )
      .limit(1);
    if (!link) {
      await db.insert(productVerticals).values({ productId, verticalId });
      verticalLinks += 1;
    }
  }

  return { upserted, verticalLinks, productIdsByEmultecId };
}

async function insertProductAvoidingCodeClash(
  row: MappedCrmProduct
): Promise<number> {
  const candidates = [
    row.code,
    `EMULTEC-${row.idProdutoEmultec}`,
    `EMULTEC-${row.idProdutoEmultec}-${Date.now()}`,
  ];

  for (const code of candidates) {
    try {
      const [inserted] = await db
        .insert(products)
        .values({
          code,
          name: row.name,
          idProdutoEmultec: row.idProdutoEmultec,
          description: row.description,
          barcode: row.barcode,
          commercialCode: row.commercialCode,
          productGroup: row.productGroup,
          brand: row.brand,
          productClassification: row.productClassification,
          simproCode: row.simproCode,
          brasindiceCode: row.brasindiceCode,
          tissCode: row.tissCode,
          manufacturer: row.manufacturer,
          countryOfOrigin: row.countryOfOrigin,
          price: row.price,
          price17: row.price17,
          price18: row.price18,
          price20: row.price20,
          brasindiceUpdatedAt: row.brasindiceUpdatedAt,
          isActive: row.isActive,
        })
        .returning({ id: products.id });
      if (!inserted) throw new Error("insert returned no row");
      return inserted.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("products_code") && !message.includes("unique")) {
        throw error;
      }
    }
  }

  throw new Error(
    `Failed to insert Emultec product ${row.idProdutoEmultec}: code clashes`
  );
}
