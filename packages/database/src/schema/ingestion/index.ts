import {
  pgSchema,
  text,
  integer,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
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
    /**
     * What the archive looked like to this run: total size, and the name, offset
     * and both sizes of each entry actually read.
     *
     * Not archive *storage* — nothing is kept, and a replay always re-fetches
     * (ADR 0009 §4). This is the diagnostic for the failure that will eventually
     * happen: DATASUS changes the export, and the question is whether an entry
     * moved, changed size, or stopped existing. Comparing two runs' manifests
     * answers that; the alternative is downloading 725 MB by hand.
     */
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

// ─── Staging — the national workload rows, replaced per competência ──────────
//
// Spec 0015 §6.7. `tbCargaHorariaSus` and `tbDadosProfissionalSus` are loaded for
// **every** establishment, not just ours, so that importing a clinic can derive
// its roster with a query instead of re-reading a 1.8 GB archive in a background
// job. A clinic imported the day after an ingestion gets its doctors in the same
// transaction that creates it, rather than waiting up to a month.
//
// This is staging, and the distinction from `registry.*` is the whole reason it
// is affordable: no foreign keys, no `atlasmed_id`, no roster semantics, no
// bridge to `public.people`. Spec 0015 §2 rejected mirroring 7.7 M workload rows,
// but that objection conflated *storing* them with *bridging* them — storing the
// six columns that matter costs ~700 MB and no semantics, while bridging is what
// would have been expensive, and bridging stays scoped in `registry.*`.
//
// **Derived, never authoritative** (invariant 9): both tables can be dropped and
// rebuilt from the archive without losing a fact. Nothing writes here but the
// loader.
//
// Rows carry the competência they came from and are never updated in place. A
// reload writes the new competência alongside the old and readers only ever see
// the one the run ledger marks COMPLETED, so an import landing mid-reload cannot
// read a half-loaded table and derive a partial roster. The previous competência
// is deleted once the new one is promoted.

/**
 * `tbCargaHorariaSus`, filtered at load to rows that carry a council
 * registration.
 *
 * The registration is the gate, not the CBO (ADR 0009 §5): what makes someone
 * resolvable against `public` is holding a council registration, and a row
 * without one describes a person we could never act on. Applying it here rather
 * than at read drops 2 500 334 of 6 734 280 rows — 37 % — that nothing would ever
 * have selected.
 *
 * **No primary key, and that is deliberate.** The obvious natural key —
 * competência, unit, professional, council, UF, registration, CBO — is not
 * unique in the source: measured on 202607, 13 605 groups repeat it for 13 667
 * excess rows, because `tbCargaHorariaSus` carries one row per workload entry and
 * this table projects away the hours and contract type that distinguish them. A
 * unique constraint here would abort every monthly load on real data.
 *
 * The duplicates are harmless because every reader aggregates with `DISTINCT`,
 * and retry safety comes from the loader deleting the competência before
 * restaging it rather than from a constraint. This is a projection of an external
 * file, not a table with an identity of its own.
 */
export const cnesCargaStaging = ingestionSchema.table(
  "carga_staging",
  {
    referenceYear: integer("reference_year").notNull(),
    referenceMonth: integer("reference_month").notNull(),
    /** CO_UNIDADE — joins `registry.facilities.cnes_unit_code`, not `cnes_id`. */
    unitCode: text("unit_code").notNull(),
    /** CO_PROFISSIONAL_SUS. */
    professionalSusId: text("professional_sus_id").notNull(),
    /** CO_CONSELHO_CLASSE — órgão emissor, resolved against registry councils. */
    councilCode: text("council_code").notNull(),
    /** SG_UF_CRM, always two characters after the load gate. */
    registrationUf: text("registration_uf").notNull(),
    /** NU_REGISTRO. */
    registrationNumber: text("registration_number").notNull(),
    /** CO_CBO. Captured for display; it decides nothing. */
    occupationCode: text("occupation_code"),
  },
  (t) => [
    /**
     * The import's only read: one establishment's rows for one competência.
     * 421 050 distinct unit codes over 4 233 946 rows, so roughly ten each.
     */
    index("cnes_carga_staging_reference_unit_idx").on(
      t.referenceYear,
      t.referenceMonth,
      t.unitCode
    ),
    /** The monthly derivation joins the other way, by person. */
    index("cnes_carga_staging_reference_professional_idx").on(
      t.referenceYear,
      t.referenceMonth,
      t.professionalSusId
    ),
  ]
);

/**
 * `tbDadosProfissionalSus`, restricted to the SUS ids that survive the carga
 * gate — 2 502 725 of them.
 *
 * `tax_id` is deliberately absent: CNES masks CPF in the public dump on 100 % of
 * rows, so it cannot match anybody and storing it would only invite someone to
 * try.
 */
export const cnesProfessionalStaging = ingestionSchema.table(
  "professional_staging",
  {
    referenceYear: integer("reference_year").notNull(),
    referenceMonth: integer("reference_month").notNull(),
    professionalSusId: text("professional_sus_id").notNull(),
    name: text("name").notNull(),
    /** NO_SOCIAL, when the export carries one — it is not a required column. */
    socialName: text("social_name"),
    /**
     * CO_CPF, **masked** in the public dump (`XXX.392.286.XX`, 5 of 11 digits
     * redacted, on 100 % of rows). It matches nobody and never will; it is
     * staged only so `registry.professionals` keeps the column it has always
     * had, rather than losing it as a side effect of changing where the loader
     * reads from. The join key is the council registration.
     */
    taxId: text("tax_id"),
    /** NO_CNS — the national health card number, when the export carries one. */
    cns: text("cns"),
  },
  (t) => [
    primaryKey({
      name: "cnes_professional_staging_pkey",
      columns: [t.referenceYear, t.referenceMonth, t.professionalSusId],
    }),
  ]
);
