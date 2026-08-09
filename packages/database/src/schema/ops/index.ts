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
 * Hard-failure dead letters for Emultec avulsa ids (upsert exceptions).
 * Gate skips (seller_unmapped, etc.) are digest-only, not stored here.
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
