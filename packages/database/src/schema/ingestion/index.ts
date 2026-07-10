import { pgSchema, text, integer, timestamp, json, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { facilities, professionals, facilityProfessionals } from "../public/facilities";

export const ingestionSchema = pgSchema("ingestion");

// ─── Enums ────────────────────────────────────────────────────────────────────

export const cnesRunStatusEnum = ingestionSchema.enum("cnes_run_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const cnesRunPhaseEnum = ingestionSchema.enum("cnes_run_phase", [
  "DISCOVERING",
  "DOWNLOADING",
  "EXTRACTING",
  "PREFLIGHT",
  "PARSING",
  "LOADING",
  "VALIDATING",
  "RECONCILING",
  "PROMOTING",
  "SYNCING",
  "FAILED",
]);

export const cnesDiffScopeEnum = ingestionSchema.enum("cnes_diff_scope", [
  "WAREHOUSE",
  "CRM",
]);

export const cnesSuggestionTypeEnum = ingestionSchema.enum("cnes_suggestion_type", [
  "FACILITY_FIELD_UPDATE",
  "PROFESSIONAL_FIELD_UPDATE",
  "FACILITY_REGISTRY_DEACTIVATED",
  "FACILITY_REGISTRY_REACTIVATED",
  "FACILITY_PROFESSIONAL_REMOVAL",
  "FACILITY_PROFESSIONAL_ADD",
  "FACILITY_REPRESENTATIVE_REMOVAL",
  "FACILITY_REPRESENTATIVE_ADD",
  "FACILITY_REPRESENTATIVE_FIELD_UPDATE",
  "CLINIC_REMOVAL",
  "CLINIC_REACTIVATION",
  "DOCTOR_CLINIC_REMOVAL",
]);

export const cnesSuggestionStatusEnum = ingestionSchema.enum("cnes_suggestion_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const cnesRuns = ingestionSchema.table(
  "cnes_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    sourceProvider: text("source_provider").notNull(),
    status: cnesRunStatusEnum("status").notNull().default("RUNNING"),
    phase: cnesRunPhaseEnum("phase"),
    phaseStartedAt: timestamp("phase_started_at"),
    temporalWorkflowId: text("temporal_workflow_id"),
    referenceAno: integer("reference_ano"),
    referenceMes: integer("reference_mes"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    promotedAt: timestamp("promoted_at"),
    stats: json("stats"),
    validationReport: json("validation_report"),
    archiveManifest: json("archive_manifest"),
    error: text("error"),
  },
  (t) => [
    index("cnes_runs_source_provider_started_at_idx").on(t.sourceProvider, t.startedAt),
    index("cnes_runs_status_idx").on(t.status),
    index("cnes_runs_temporal_workflow_id_idx").on(t.temporalWorkflowId),
  ]
);

export const cnesDiffs = ingestionSchema.table(
  "cnes_diffs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    cnesRunId: text("cnes_run_id").notNull().references(() => cnesRuns.id, { onDelete: "cascade" }),
    scope: cnesDiffScopeEnum("scope").notNull(),
    entityType: text("entity_type").notNull(),
    externalSourceId: text("external_source_id"),
    diffType: text("diff_type").notNull(),
    payload: json("payload").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("cnes_diffs_cnes_run_id_idx").on(t.cnesRunId),
    index("cnes_diffs_scope_entity_type_idx").on(t.scope, t.entityType),
  ]
);

export const cnesSuggestions = ingestionSchema.table(
  "cnes_suggestions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    cnesRunId: text("cnes_run_id").notNull().references(() => cnesRuns.id, { onDelete: "cascade" }),
    type: cnesSuggestionTypeEnum("type").notNull(),
    status: cnesSuggestionStatusEnum("status").notNull().default("PENDING"),
    facilityId: text("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    professionalId: text("professional_id").references(() => professionals.id, { onDelete: "set null" }),
    facilityProfessionalId: text("facility_professional_id").references(() => facilityProfessionals.id, { onDelete: "set null" }),
    reason: text("reason"),
    payload: json("payload").notNull().default({}),
    suggestedAt: timestamp("suggested_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    index("cnes_suggestions_status_type_idx").on(t.status, t.type),
    index("cnes_suggestions_facility_id_status_idx").on(t.facilityId, t.status),
    index("cnes_suggestions_cnes_run_id_idx").on(t.cnesRunId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const cnesRunsRelations = relations(cnesRuns, ({ many }) => ({
  suggestions: many(cnesSuggestions),
  diffs: many(cnesDiffs),
}));

export const cnesDiffsRelations = relations(cnesDiffs, ({ one }) => ({
  cnesRun: one(cnesRuns, {
    fields: [cnesDiffs.cnesRunId],
    references: [cnesRuns.id],
  }),
}));

export const cnesSuggestionsRelations = relations(cnesSuggestions, ({ one }) => ({
  cnesRun: one(cnesRuns, {
    fields: [cnesSuggestions.cnesRunId],
    references: [cnesRuns.id],
  }),
  facility: one(facilities, {
    fields: [cnesSuggestions.facilityId],
    references: [facilities.id],
  }),
  professional: one(professionals, {
    fields: [cnesSuggestions.professionalId],
    references: [professionals.id],
  }),
  facilityProfessional: one(facilityProfessionals, {
    fields: [cnesSuggestions.facilityProfessionalId],
    references: [facilityProfessionals.id],
  }),
}));
