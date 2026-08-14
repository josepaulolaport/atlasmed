import {
  pgSchema,
  text,
  timestamp,
  jsonb,
  bigint,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Operational machinery (import digests, DLQ) — not CRM domain. */
export const opsSchema = pgSchema("ops");

/** One digest row per Emultec order-import run (Temporal or CLI). */
export const emultecOrderImportRuns = opsSchema.table(
  "emultec_order_import_runs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    workflowId: text("workflow_id"),
    mode: text("mode").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetched: integer("fetched").notNull().default(0),
    upserted: integer("upserted").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    skipReasons: jsonb("skip_reasons").$type<Record<string, number>>().notNull().default({}),
    watermarkBefore: bigint("watermark_before", { mode: "number" }),
    watermarkAfter: bigint("watermark_after", { mode: "number" }),
    status: text("status").notNull().default("RUNNING"),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("emultec_order_import_runs_started_at_idx").on(t.startedAt),
    index("emultec_order_import_runs_status_idx").on(t.status),
  ]
);

/**
 * What a skipped Emultec order is waiting on, when the answer lives in our own
 * database.
 *
 * `NONE` covers skips only Emultec can fix — an avulsa with no `Id_Vendedor`, a
 * client with no usable document. They are recorded for visibility (otherwise
 * the only trace is a counter in the run digest) but never re-checked, because
 * nothing we do here can clear them.
 */
export const emultecSkipBlockerEnum = opsSchema.enum("emultec_skip_blocker", [
  "DOCUMENT",
  "SELLER",
  "PRODUCTS",
  "NONE",
]);

/**
 * Emultec orders the importer could not place, and the thing each is waiting for.
 *
 * These used to be counted and forgotten: a skip bumped a number in the run
 * digest and the order was never looked at again. But a skip is almost never
 * about Emultec — it is our reference data that is missing, so the event that
 * unblocks it (a rep mapped, a clinic created, a CPF corrected, the CNES import
 * landing) happens *here*, where a date-window RECONCILE against Emultec cannot
 * see it. Orders stayed invisible until someone remembered to run a backfill.
 *
 * Recording the blocker lets the answer be found without touching Emultec at
 * all: ask our own tables whether the document now matches, whether a user now
 * carries that vendedor id. Only the rows that flipped are fetched back, by id.
 *
 * A row records the *first* blocker resolution hit, since resolution
 * short-circuits. If that clears and the order then fails on something else, it
 * is re-recorded with the new blocker — one fetch per transition, converging.
 */
export const emultecOrderImportPending = opsSchema.table(
  "emultec_order_import_pending",
  {
    idAvulsaEmultec: bigint("id_avulsa_emultec", { mode: "number" }).primaryKey(),
    /** The importer's skip reason, verbatim — matches the run digest keys. */
    reason: text("reason").notNull(),
    blocker: emultecSkipBlockerEnum("blocker").notNull(),
    /** Emultec `clientes.Id`, for operators tracing a row back. */
    idClienteEmultec: bigint("id_cliente_emultec", { mode: "number" }),
    /**
     * DOCUMENT: every digits-only document the resolve tried, in the order it
     * tried them — a PF→PJ client contributes the parent's CNPJ *and* the
     * buyer's own CPF, and either one appearing in `facilities` unblocks the
     * order. Storing only the first would leave the second permanently invisible.
     *
     * Covers both `facility_no_match` (waiting for 0 → 1 active facility) and
     * `facility_ambiguous` (waiting for 2 → 1, usually by an operator recording
     * a link rather than by the data changing — two clinics can legitimately
     * share one CPF).
     *
     * No companion type column: `facilities.legal_document` is digits-only, CNPJ
     * is always 14 digits and CPF always 11, and no document exists under both
     * types (verified against the 2026-08-09 prod snapshot: 1 254 / 189 / 0).
     * Length already decides, so a type would only be a second thing to keep
     * in sync.
     */
    blockerDocuments: text("blocker_documents").array(),
    /** SELLER: `avulsa.Id_Vendedor` with no `users.id_vendedor_emultec`. */
    idVendedorEmultec: bigint("id_vendedor_emultec", { mode: "number" }),
    /**
     * PRODUCTS: every Emultec product id on the avulsa, none of which mapped.
     * Any one of them gaining a `products` row unblocks the order — the importer
     * writes as soon as a single line maps — so this is a set to test membership
     * against, not a checklist to complete.
     *
     * A real array, not jsonb: the re-check compares it directly against
     * `products.id_produto_emultec` (a bigint), which jsonb can only do through
     * `jsonb_array_elements` plus a cast.
     */
    blockerProductIds: bigint("blocker_product_ids", { mode: "number" }).array(),
    firstSkippedAt: timestamp("first_skipped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSkippedAt: timestamp("last_skipped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    skipCount: integer("skip_count").notNull().default(1),
    /**
     * Set when the order finally imports. Deliberately no attempt cap: unlike a
     * dead letter, a skip is not failing — it is waiting on data entry that may
     * take weeks, and giving up on it is the bug this table exists to fix.
     */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    /** The re-check scan: open rows of one blocker kind. */
    index("emultec_order_import_pending_open_blocker_idx")
      .on(t.blocker)
      .where(sql`${t.resolvedAt} IS NULL`),
    /**
     * No index on `blocker_documents`: the DOCUMENT re-check drives off the
     * partial index above and probes `facilities` per row on its own unique
     * document index. Indexing the array would only serve the reverse lookup
     * (facility → waiting orders), which nothing asks for.
     */
    /** Joins to users on the vendedor id. */
    index("emultec_order_import_pending_vendedor_idx")
      .on(t.idVendedorEmultec)
      .where(sql`${t.resolvedAt} IS NULL AND ${t.idVendedorEmultec} IS NOT NULL`),
  ]
);

/**
 * Hard-failure dead letters for Emultec avulsa ids (upsert exceptions).
 *
 * Distinct from `emultec_order_import_pending`: this is "the import threw", which
 * is a fault to fix and carries an attempt cap so a poison message cannot retry
 * forever. A skip is "we are not ready for this order yet" and has no cap.
 */
export const emultecOrderImportDeadLetters = opsSchema.table(
  "emultec_order_import_dead_letters",
  {
    idAvulsaEmultec: bigint("id_avulsa_emultec", { mode: "number" }).primaryKey(),
    reason: text("reason").notNull(),
    detail: text("detail"),
    attemptCount: integer("attempt_count").notNull().default(0),
    firstFailedAt: timestamp("first_failed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("emultec_order_import_dead_letters_open_idx")
      .on(t.lastFailedAt)
      .where(sql`${t.resolvedAt} IS NULL`),
  ]
);
