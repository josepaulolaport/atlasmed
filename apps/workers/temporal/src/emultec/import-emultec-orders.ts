import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  businessVerticals,
  facilities,
  facilityEmultecClients,
  facilityVerticalProfiles,
  orderItems,
  orders,
  persons,
  products,
  users,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";
import { logger } from "../logger";
import {
  fetchEmultecOrdersByIds,
  fetchEmultecOrdersPage,
  type EmultecOrderBundle,
  type EmultecOrderPageMode,
} from "./fetch-emultec-orders";
import {
  listOpenEmultecDeadLetterIds,
  recordEmultecDeadLetter,
  resolveEmultecDeadLetter,
} from "./emultec-order-import-ops";
import { mapEmultecOrderStatus } from "./map-emultec-order-status";
import { resolveEmultecFacility } from "./resolve-emultec-facility";

const ORTOPEDIA_CODE = "ORTOPEDIA";

export type ImportEmultecOrdersPageInput = {
  mode: EmultecOrderPageMode;
  afterId?: number;
  limit: number;
  /** RECONCILE: YYYY-MM-DD */
  sinceDate?: string;
};

export type ImportEmultecOrdersPageResult = {
  fetched: number;
  upserted: number;
  skipped: number;
  lastId: number | null;
  skipReasons: Record<string, number>;
  /** Facilities touched by successful upserts (for purchase-recurrence). */
  facilityIds: number[];
};

/** High-water mark = max imported Emultec avulsa id in CRM (0 if none). */
export async function getEmultecOrderWatermark(): Promise<number> {
  const [row] = await db
    .select({
      maxId: sql<number>`coalesce(max(${orders.idAvulsaEmultec}), 0)`,
    })
    .from(orders);
  return Number(row?.maxId ?? 0);
}

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

/**
 * Records which clinic an Emultec client buys for, so later imports resolve on
 * the cheap primary-key branch instead of re-deriving the document match.
 *
 * Writes to `facility_emultec_clients`, which is keyed on the *client*. That is
 * the direction the constraint belongs in: one client resolves to one clinic,
 * while a clinic may legitimately have several clients — a clinic's surgeons
 * each bill as their own pessoa-física row under its CNPJ. The old column on
 * `facilities` could hold only one of them and quietly kept whichever was
 * written first.
 *
 * Never repoints an existing link: if the client already names a clinic, that
 * came from an operator or an earlier resolve, and disagreeing with it is a
 * conflict to look at rather than to overwrite. Best-effort — an order that
 * resolved correctly must not be dead-lettered over a bookkeeping row.
 */
async function linkEmultecClient(
  facilityId: number,
  idCliente: number,
  via: "cnpj" | "cpf"
): Promise<void> {
  try {
    await db
      .insert(facilityEmultecClients)
      .values({
        idClienteEmultec: idCliente,
        facilityId,
        source: via === "cnpj" ? "AUTO_CNPJ" : "AUTO_CPF",
      })
      .onConflictDoNothing({ target: facilityEmultecClients.idClienteEmultec });
  } catch (error) {
    logger.warn("emultec.order_import.client_link_failed", {
      facilityId,
      idCliente,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function findFacilityId(
  bundle: EmultecOrderBundle
): Promise<{ facilityId: number } | { skip: string }> {
  const [linked] = await db
    .select({
      id: facilities.id,
      legalDocument: facilities.legalDocument,
      legalDocumentType: facilities.legalDocumentType,
    })
    .from(facilityEmultecClients)
    .innerJoin(
      facilities,
      eq(facilities.id, facilityEmultecClients.facilityId)
    )
    .where(
      and(
        eq(facilityEmultecClients.idClienteEmultec, bundle.idCliente),
        isNull(facilities.deactivatedAt)
      )
    )
    .limit(1);

  const byIdCliente = new Map(
    linked
      ? [
          [
            bundle.idCliente,
            {
              id: linked.id,
              idClienteEmultec: bundle.idCliente,
              legalDocument: linked.legalDocument,
              legalDocumentType: linked.legalDocumentType,
            },
          ] as const,
        ]
      : []
  );

  // Every document the client carries, not just the first one resolve would try
  // — `resolveEmultecFacility` falls back from CNPJ to CPF, and it can only do
  // that if both were loaded. Filtering by document alone (not by type) keeps a
  // facility whose `legal_document_type` disagrees with ours in the candidate
  // set, so resolve decides rather than the query.
  const docDigits = [
    bundle.idClientePj != null ? bundle.pjCnpjDigits : bundle.clientCnpjDigits,
    bundle.clientCpfDigits,
  ].filter(
    (digits): digits is string =>
      digits != null && (digits.length === 14 || digits.length === 11)
  );

  const candidates = docDigits.length === 0
    ? []
    : await db
      .select({
        id: facilities.id,
        idClienteEmultec: facilities.idClienteEmultec,
        legalDocument: facilities.legalDocument,
        legalDocumentType: facilities.legalDocumentType,
      })
      .from(facilities)
      .where(
        and(
          inArray(facilities.legalDocument, [...new Set(docDigits)]),
          isNull(facilities.deactivatedAt)
        )
      );

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

  /**
   * Record the link when the client's *own* document found the clinic.
   *
   * The new table could hold the PF→PJ case too — one row per surgeon pointing
   * at the clinic is exactly what it is for, and the old column could not
   * express it. It is still left out, for a different reason than before: a
   * cached link wins over document matching, and a surgeon who moves to another
   * clinic would keep resolving to the old one until someone noticed. Their
   * parent pointer is re-read from Emultec on every import, so leaving that path
   * dynamic costs one extra lookup and cannot go stale. A clinic's own CNPJ does
   * not move, so caching that is safe.
   */
  if (
    (resolved.via === "cnpj" || resolved.via === "cpf") &&
    bundle.idClientePj == null
  ) {
    await linkEmultecClient(resolved.facilityId, bundle.idCliente, resolved.via);
  }

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
): Promise<{ outcome: "upserted"; facilityId: number } | { outcome: "skipped" }> {
  if (bundle.lines.length === 0) {
    bump(skipReasons, "no_whitelist_lines");
    return { outcome: "skipped" };
  }

  const knownLines = bundle.lines.filter((line) =>
    productMap.has(line.idProdutoEmultec)
  );
  if (knownLines.length === 0) {
    bump(skipReasons, "products_unmapped");
    return { outcome: "skipped" };
  }

  const seller = await resolveSellerId(bundle.idVendedor);
  if (typeof seller === "object") {
    bump(skipReasons, seller.skip);
    return { outcome: "skipped" };
  }

  const facility = await findFacilityId(bundle);
  if ("skip" in facility) {
    bump(skipReasons, facility.skip);
    return { outcome: "skipped" };
  }

  // Spec 0010 §4 — orders key on the profile, so one must exist before the order
  // can be written. This THROWS rather than returning a skip: the caller
  // dead-letters on throw and only counts skips, and an Emultec order is real
  // revenue. Silently incrementing a counter is how the importer wrote orders
  // that no per-vertical metric could see in the first place.
  //
  // The DLQ is keyed on id_avulsa_emultec, so once the missing profile is created
  // the order replays cleanly.
  const [verticalProfile] = await db
    .select({ id: facilityVerticalProfiles.id })
    .from(facilityVerticalProfiles)
    .where(
      and(
        eq(facilityVerticalProfiles.facilityId, facility.facilityId),
        eq(facilityVerticalProfiles.verticalId, verticalId),
      ),
    )
    .limit(1);

  if (!verticalProfile) {
    throw new Error(
      `No facility_vertical_profile for facility ${facility.facilityId} in vertical ${verticalId}; ` +
        `refusing to import Emultec order ${bundle.idAvulsa}. Create the profile, then replay.`,
    );
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
        facilityVerticalProfileId: verticalProfile.id,
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
        facilityVerticalProfileId: verticalProfile.id,
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

  return { outcome: "upserted", facilityId: facility.facilityId };
}

async function loadPageBundles(
  input: ImportEmultecOrdersPageInput
): Promise<{ page: EmultecOrderBundle[]; cursorLastId: number | null }> {
  const afterId = input.afterId ?? 0;
  const limit = Math.max(1, Math.min(input.limit, 500));

  if (input.mode === "DLQ_REPLAY") {
    const ids = await listOpenEmultecDeadLetterIds({ afterId, limit });
    if (ids.length === 0) {
      return { page: [], cursorLastId: afterId || null };
    }
    const page = await fetchEmultecOrdersByIds(ids);
    return { page, cursorLastId: ids[ids.length - 1] ?? afterId };
  }

  const page = await fetchEmultecOrdersPage({
    mode: input.mode,
    afterId,
    limit,
    sinceDate: input.sinceDate,
  });
  return {
    page,
    cursorLastId: page.length > 0 ? page[page.length - 1]!.idAvulsa : afterId || null,
  };
}

/** Import one page of Emultec avulsa → CRM orders/items (hard gates). */
export async function importEmultecOrdersPage(
  input: ImportEmultecOrdersPageInput
): Promise<ImportEmultecOrdersPageResult> {
  const { page, cursorLastId } = await loadPageBundles(input);

  const skipReasons: Record<string, number> = {};
  const facilityIds: number[] = [];
  if (page.length === 0) {
    return {
      fetched: 0,
      upserted: 0,
      skipped: 0,
      lastId: cursorLastId,
      skipReasons,
      facilityIds,
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
      const result = await upsertOneOrder(
        bundle,
        verticalId,
        productMap,
        skipReasons
      );
      if (result.outcome === "upserted") {
        upserted += 1;
        facilityIds.push(result.facilityId);
        await resolveEmultecDeadLetter(bundle.idAvulsa);
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;
      bump(skipReasons, "error");
      const detail = error instanceof Error ? error.message : String(error);
      await recordEmultecDeadLetter({
        idAvulsa: bundle.idAvulsa,
        reason: "error",
        detail,
      });
      logger.error("emultec.order_import.failed", error, {
        idAvulsa: bundle.idAvulsa,
      });
    }
  }

  return {
    fetched: page.length,
    upserted,
    skipped,
    lastId: cursorLastId,
    skipReasons,
    facilityIds: [...new Set(facilityIds)],
  };
}
