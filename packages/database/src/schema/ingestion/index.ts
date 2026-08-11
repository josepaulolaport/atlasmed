import {
  pgSchema,
  text,
  integer,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * CNES ingest run tracking.
 *
 * Deliberately one table. The deleted ingest vertical carried `cnes_diffs` and
 * `cnes_suggestions` with twelve suggestion types and an approve surface; v1 does
 * not reconcile into `public` at all — it loads a read-only mirror — so there is
 * nothing to diff and nothing to approve. Adding those tables before a feature
 * needs them is how the previous pipeline accumulated the weight that got it
 * deleted.
 */
export const ingestionSchema = pgSchema("ingestion");

export const cnesRunStatusEnum = ingestionSchema.enum("cnes_run_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

/**
 * Where a run is right now. Distinct from `status`: `phase` describes in-flight
 * progress and is meaningless once terminal, `status` is the terminal verdict.
 * Collapsing them loses "failed during PROMOTING" versus "failed during
 * DOWNLOADING", which is the first thing anyone asks.
 */
export const cnesRunPhaseEnum = ingestionSchema.enum("cnes_run_phase", [
  "DISCOVERING",
  "DOWNLOADING",
  "EXTRACTING",
  "PREFLIGHT",
  "LOADING",
  "VALIDATING",
  "PROMOTING",
  "BRIDGING",
]);

export const cnesRuns = ingestionSchema.table(
  "cnes_runs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Temporal workflow id — `cnes-ingestion-{YYYY}-{MM}`. */
    temporalWorkflowId: text("temporal_workflow_id"),
    /** CNES competence being loaded. */
    referenceYear: integer("reference_year"),
    referenceMonth: integer("reference_month"),
    status: cnesRunStatusEnum("status").notNull().default("RUNNING"),
    phase: cnesRunPhaseEnum("phase"),
    phaseStartedAt: timestamp("phase_started_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    /** Per-table row counts and timings. */
    stats: jsonb("stats"),
    /** Output of the post-load validation gate. */
    validationReport: jsonb("validation_report"),
    /** Archive keys + checksums, so a run can be replayed without re-fetching. */
    archiveManifest: jsonb("archive_manifest"),
    error: text("error"),
  },
  (t) => [
    /**
     * One run per competence may be in flight. Makes a duplicate workflow start
     * a constraint violation rather than two loaders racing on the same staging
     * tables.
     */
    uniqueIndex("cnes_runs_active_reference_uidx")
      .on(t.referenceYear, t.referenceMonth)
      .where(sql`${t.status} = 'RUNNING'`),
    uniqueIndex("cnes_runs_temporal_workflow_id_uidx")
      .on(t.temporalWorkflowId)
      .where(sql`${t.temporalWorkflowId} IS NOT NULL`),
    index("cnes_runs_status_started_at_idx").on(t.status, t.startedAt),
  ]
);
