import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  emultecOrderImportPending,
  facilities,
  facilityEmultecClients,
  products,
  users,
  type Database,
} from "@atlasmed/database";
import { db } from "../infrastructure/db";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * A database handle or an open transaction.
 *
 * Every function here takes one so the DB-backed tests can thread the harness's
 * rolled-back transaction in — a query issued against the module-level `db`
 * runs on a different connection and cannot see the seeded rows. Production
 * callers pass nothing.
 */
type Executor = Database | Tx;

/**
 * What a skipped order is waiting on. `NONE` means the answer is not in our
 * database at all — Emultec itself has to change — so those rows are recorded
 * for visibility but never re-checked.
 */
export type EmultecSkipBlocker = "DOCUMENT" | "SELLER" | "PRODUCTS" | "NONE";

export type EmultecSkipDetail = {
  /** The importer's skip reason, verbatim — same keys as the run digest. */
  reason: string;
  blocker: EmultecSkipBlocker;
  idClienteEmultec?: number | null;
  /** DOCUMENT: every document the resolve tried, in order. */
  blockerDocuments?: string[] | null;
  /** SELLER: the unmapped `avulsa.Id_Vendedor`. */
  idVendedorEmultec?: number | null;
  /** PRODUCTS: Emultec product ids with no row in `products`. */
  blockerProductIds?: number[] | null;
};

/**
 * Record that an order was skipped, and what it is waiting for.
 *
 * Keyed on the avulsa id, so a re-processed order updates in place rather than
 * accumulating a row per attempt. The blocker is overwritten every time: skips
 * short-circuit at the first failing gate, so an order that clears its document
 * and then fails on the seller is genuinely waiting on the seller now.
 *
 * `resolved_at` is cleared on every skip. An order that imported, was later
 * re-processed, and skipped again is open again — the alternative would leave a
 * stale resolution shadowing a real block.
 */
export async function recordEmultecSkip(
  input: {
    idAvulsa: number;
    detail: EmultecSkipDetail;
  },
  executor: Executor = db
): Promise<void> {
  const { idAvulsa, detail } = input;
  const now = new Date();
  const values = {
    reason: detail.reason,
    blocker: detail.blocker,
    idClienteEmultec: detail.idClienteEmultec ?? null,
    blockerDocuments: detail.blockerDocuments ?? null,
    idVendedorEmultec: detail.idVendedorEmultec ?? null,
    blockerProductIds: detail.blockerProductIds ?? null,
  };

  await executor
    .insert(emultecOrderImportPending)
    .values({
      idAvulsaEmultec: idAvulsa,
      ...values,
      firstSkippedAt: now,
      lastSkippedAt: now,
      skipCount: 1,
      resolvedAt: null,
    })
    .onConflictDoUpdate({
      target: emultecOrderImportPending.idAvulsaEmultec,
      set: {
        ...values,
        lastSkippedAt: now,
        skipCount: sql`${emultecOrderImportPending.skipCount} + 1`,
        resolvedAt: null,
      },
    });
}

/** Close the pending row for an order that finally imported. */
export async function resolveEmultecSkip(
  idAvulsa: number,
  executor: Executor = db
): Promise<void> {
  await executor
    .update(emultecOrderImportPending)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(emultecOrderImportPending.idAvulsaEmultec, idAvulsa),
        isNull(emultecOrderImportPending.resolvedAt)
      )
    );
}

/**
 * Skipped orders whose blocker now looks cleared, cheapest question first.
 *
 * Every predicate here mirrors the importer's own resolve exactly — same tables,
 * same filters, no extra ones. That matters in both directions: a *stricter*
 * check would hold an importable order back forever, and a *looser* one only
 * costs one wasted fetch. Where the importer does not filter (it accepts any
 * `users` row carrying the vendedor id, deactivated or not, and any `products`
 * row regardless of `is_active`), neither does this.
 *
 * The reverse is also why this can run on a short tick: it touches only our own
 * tables. Emultec is read afterwards, by id, for the rows that actually flipped.
 */
export async function listUnblockedEmultecOrderIds(
  input: { limit: number; afterId?: number },
  executor: Executor = db
): Promise<number[]> {
  const p = emultecOrderImportPending;

  /**
   * A link naming the clinic. Recorded by an operator, or by an earlier import
   * that resolved the client's own document — resolve consults it before any
   * document matching, so once it exists the import succeeds.
   */
  const linkExists = sql`EXISTS (
        SELECT 1
        FROM ${facilityEmultecClients} l
        JOIN ${facilities} lf ON lf.id = l.facility_id
        WHERE l.id_cliente_emultec = ${p.idClienteEmultec}
          AND lf.deactivated_at IS NULL
      )`;

  /**
   * A document blocker clears differently depending on *why* it blocked, and
   * conflating the two makes ambiguous orders churn forever.
   *
   * `facility_no_match` waits for 0 → 1: a facility appearing (or being
   * reactivated) under one of the documents resolve tried. A link also does it.
   *
   * `facility_ambiguous` waits for 2 → 1, and **only a link clears it**. Two
   * active facilities can legitimately share a CPF — one surgeon, two
   * consultórios in different municipalities — so nobody deletes one; an
   * operator picks the right clinic. Asking "does a facility carry this
   * document?" is always true for these rows by definition, so it would surface
   * them on every single tick, fetch them from Emultec, watch them skip as
   * ambiguous again, and repeat — the exact third-party traffic this queue
   * exists to avoid.
   */
  const documentCleared = sql`
    ${p.blocker} = 'DOCUMENT'
    AND (
      ${linkExists}
      OR (
        ${p.reason} <> 'facility_ambiguous'
        AND EXISTS (
          SELECT 1 FROM ${facilities} f
          WHERE f.legal_document = ANY(${p.blockerDocuments})
            AND f.deactivated_at IS NULL
        )
      )
    )`;

  const sellerCleared = sql`
    ${p.blocker} = 'SELLER'
    AND EXISTS (
      SELECT 1 FROM ${users} u
      WHERE u.id_vendedor_emultec = ${p.idVendedorEmultec}
    )`;

  /**
   * *Any* mapped product clears it, not all of them. The importer skips only
   * when nothing on the avulsa maps and writes the order as soon as one line
   * does, so demanding the full set here would strand orders it would happily
   * import. (That the importer drops unmapped lines — and so understates those
   * orders' totals — is real, but it is its existing behaviour on every order
   * that gets through, not something this queue should diverge on.)
   */
  const productsCleared = sql`
    ${p.blocker} = 'PRODUCTS'
    AND EXISTS (
      SELECT 1 FROM ${products} pr
      WHERE pr.id_produto_emultec = ANY(${p.blockerProductIds})
    )`;

  const rows = await executor
    .select({ idAvulsa: p.idAvulsaEmultec })
    .from(p)
    .where(
      and(
        isNull(p.resolvedAt),
        input.afterId ? gt(p.idAvulsaEmultec, input.afterId) : undefined,
        or(documentCleared, sellerCleared, productsCleared)
      )
    )
    .orderBy(asc(p.idAvulsaEmultec))
    .limit(Math.max(1, Math.min(input.limit, 500)));

  return rows.map((r) => r.idAvulsa);
}
