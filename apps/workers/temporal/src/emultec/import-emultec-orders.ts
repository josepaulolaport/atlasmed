import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  businessVerticals,
  facilities,
  orderItems,
  orders,
  persons,
  products,
  users,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import { logger } from "../logger";
import {
  fetchEmultecOrdersPage,
  type EmultecOrderBundle,
} from "./fetch-emultec-orders";
import { mapEmultecOrderStatus } from "./map-emultec-order-status";
import { resolveEmultecFacility } from "./resolve-emultec-facility";

const ORTOPEDIA_CODE = "ORTOPEDIA";

export type ImportEmultecOrdersPageInput = {
  afterId?: number;
  limit: number;
};

export type ImportEmultecOrdersPageResult = {
  fetched: number;
  upserted: number;
  skipped: number;
  lastId: number | null;
  skipReasons: Record<string, number>;
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

function parseOrderedAt(raw: string | null): Date {
  if (!raw) return new Date("1970-01-01T00:00:00.000Z");
  // MySQL date YYYY-MM-DD
  const d = new Date(`${raw}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date("1970-01-01T00:00:00.000Z") : d;
}

function bump(reasons: Record<string, number>, key: string) {
  reasons[key] = (reasons[key] ?? 0) + 1;
}

async function findFacilityId(
  bundle: EmultecOrderBundle
): Promise<{ facilityId: number } | { skip: string }> {
  const [stamped] = await db
    .select({
      id: facilities.id,
      idClienteEmultec: facilities.idClienteEmultec,
      legalDocument: facilities.legalDocument,
      legalDocumentType: facilities.legalDocumentType,
    })
    .from(facilities)
    .where(
      and(
        eq(facilities.idClienteEmultec, bundle.idCliente),
        isNull(facilities.deactivatedAt),
        isNotNull(facilities.cnesCode),
        sql`trim(${facilities.cnesCode}) <> ''`
      )
    )
    .limit(1);

  const byIdCliente = new Map(
    stamped
      ? [
          [
            bundle.idCliente,
            {
              id: stamped.id,
              idClienteEmultec: stamped.idClienteEmultec,
              legalDocument: stamped.legalDocument,
              legalDocumentType: stamped.legalDocumentType,
            },
          ] as const,
        ]
      : []
  );

  let docDigits: string | null = null;
  let docType: "CNPJ" | "CPF" | null = null;
  if (bundle.idClientePj != null) {
    docDigits = bundle.pjCnpjDigits;
    docType = "CNPJ";
  } else if (bundle.clientCnpjDigits?.length === 14) {
    docDigits = bundle.clientCnpjDigits;
    docType = "CNPJ";
  } else if (bundle.clientCpfDigits?.length === 11) {
    docDigits = bundle.clientCpfDigits;
    docType = "CPF";
  }

  let candidates: Array<{
    id: number;
    idClienteEmultec: number | null;
    legalDocument: string | null;
    legalDocumentType: "CNPJ" | "CPF" | null;
  }> = [];

  if (docDigits && docType) {
    candidates = await db
      .select({
        id: facilities.id,
        idClienteEmultec: facilities.idClienteEmultec,
        legalDocument: facilities.legalDocument,
        legalDocumentType: facilities.legalDocumentType,
      })
      .from(facilities)
      .where(
        and(
          eq(facilities.legalDocument, docDigits),
          eq(facilities.legalDocumentType, docType),
          isNull(facilities.deactivatedAt),
          isNotNull(facilities.cnesCode),
          sql`trim(${facilities.cnesCode}) <> ''`
        )
      );
  }

  const resolved = resolveEmultecFacility(
    {
      idCliente: bundle.idCliente,
      idClientePj: bundle.idClientePj,
      cnpjDigits: bundle.clientCnpjDigits,
      cpfDigits: bundle.clientCpfDigits,
      pjCnpjDigits: bundle.pjCnpjDigits,
    },
    candidates,
    byIdCliente
  );

  if (!resolved.ok) return { skip: `facility_${resolved.reason}` };
  return { facilityId: resolved.facilityId };
}

async function resolveSellerId(
  idVendedor: number | null
): Promise<number | { skip: string }> {
  if (idVendedor == null || !Number.isFinite(idVendedor)) {
    return { skip: "seller_missing" };
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.idVendedorEmultec, idVendedor))
    .limit(1);
  if (!row) return { skip: "seller_unmapped" };
  return row.id;
}

async function resolvePersonId(
  bundle: EmultecOrderBundle
): Promise<number | null> {
  if (bundle.idClientePj == null) return null;
  const cpf = bundle.clientCpfDigits;
  if (!cpf || cpf.length !== 11) return null;
  const [row] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.cpf, cpf), isNull(persons.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

async function loadProductMap(
  emultecProductIds: number[]
): Promise<Map<number, number>> {
  if (emultecProductIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: products.id,
      idProdutoEmultec: products.idProdutoEmultec,
    })
    .from(products)
    .where(inArray(products.idProdutoEmultec, emultecProductIds));
  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.idProdutoEmultec != null) {
      map.set(row.idProdutoEmultec, row.id);
    }
  }
  return map;
}

async function upsertOneOrder(
  bundle: EmultecOrderBundle,
  verticalId: number,
  productMap: Map<number, number>,
  skipReasons: Record<string, number>
): Promise<"upserted" | "skipped"> {
  if (bundle.lines.length === 0) {
    bump(skipReasons, "no_whitelist_lines");
    return "skipped";
  }

  const knownLines = bundle.lines.filter((line) =>
    productMap.has(line.idProdutoEmultec)
  );
  if (knownLines.length === 0) {
    bump(skipReasons, "products_unmapped");
    return "skipped";
  }

  const seller = await resolveSellerId(bundle.idVendedor);
  if (typeof seller === "object") {
    bump(skipReasons, seller.skip);
    return "skipped";
  }

  const facility = await findFacilityId(bundle);
  if ("skip" in facility) {
    bump(skipReasons, facility.skip);
    return "skipped";
  }

  const personId = await resolvePersonId(bundle);
  const status = mapEmultecOrderStatus(bundle.status);
  const orderedAt = parseOrderedAt(bundle.orderedAt);

  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.idAvulsaEmultec, bundle.idAvulsa))
    .limit(1);

  let orderId: number;
  if (existing) {
    orderId = existing.id;
    await db
      .update(orders)
      .set({
        facilityId: facility.facilityId,
        verticalId,
        sellerId: seller,
        personId,
        status,
        type: "SALE",
        orderedAt,
        notes: bundle.notes,
        freight: String(bundle.freight),
        grossWeight: String(bundle.grossWeight),
        netWeight: String(bundle.netWeight),
      })
      .where(eq(orders.id, orderId));
  } else {
    const [inserted] = await db
      .insert(orders)
      .values({
        idAvulsaEmultec: bundle.idAvulsa,
        facilityId: facility.facilityId,
        verticalId,
        sellerId: seller,
        personId,
        status,
        type: "SALE",
        orderedAt,
        notes: bundle.notes,
        freight: String(bundle.freight),
        grossWeight: String(bundle.grossWeight),
        netWeight: String(bundle.netWeight),
      })
      .returning({ id: orders.id });
    if (!inserted) throw new Error("order insert returned no row");
    orderId = inserted.id;
  }

  for (const line of knownLines) {
    const productId = productMap.get(line.idProdutoEmultec)!;
    const [existingItem] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.idAvulsaItemEmultec, line.idAvulsaItemEmultec))
      .limit(1);

    if (existingItem) {
      await db
        .update(orderItems)
        .set({
          orderId,
          productId,
          idProdutoEmultec: line.idProdutoEmultec,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
        })
        .where(eq(orderItems.id, existingItem.id));
    } else {
      await db.insert(orderItems).values({
        idAvulsaItemEmultec: line.idAvulsaItemEmultec,
        orderId,
        productId,
        idProdutoEmultec: line.idProdutoEmultec,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
      });
    }
  }

  return "upserted";
}

/** Import one page of Emultec avulsa → CRM orders/items (hard gates). */
export async function importEmultecOrdersPage(
  input: ImportEmultecOrdersPageInput
): Promise<ImportEmultecOrdersPageResult> {
  const page = await fetchEmultecOrdersPage({
    afterId: input.afterId,
    limit: input.limit,
  });

  const skipReasons: Record<string, number> = {};
  if (page.length === 0) {
    return {
      fetched: 0,
      upserted: 0,
      skipped: 0,
      lastId: input.afterId ?? null,
      skipReasons,
    };
  }

  const verticalId = await resolveOrtopediaVerticalId();
  const productIds = [
    ...new Set(page.flatMap((b) => b.lines.map((l) => l.idProdutoEmultec))),
  ];
  const productMap = await loadProductMap(productIds);

  let upserted = 0;
  let skipped = 0;
  for (const bundle of page) {
    try {
      const outcome = await upsertOneOrder(
        bundle,
        verticalId,
        productMap,
        skipReasons
      );
      if (outcome === "upserted") upserted += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      bump(skipReasons, "error");
      logger.error("emultec.order_import.failed", error, {
        idAvulsa: bundle.idAvulsa,
      });
    }
  }

  const lastId = page[page.length - 1]!.idAvulsa;
  return {
    fetched: page.length,
    upserted,
    skipped,
    lastId,
    skipReasons,
  };
}
