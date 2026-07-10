import {
  pgTable,
  text,
  integer,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  ingestionRunStatusEnum,
  ingestionRunPhaseEnum,
  ingestionDiffScopeEnum,
  ingestionSuggestionTypeEnum,
  ingestionSuggestionStatusEnum,
} from "./enums";
import { facilities, professionals, facilityProfessionals } from "./facilities";

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    sourceProvider: text("source_provider").notNull(),
    status: ingestionRunStatusEnum("status").notNull().default("RUNNING"),
    phase: ingestionRunPhaseEnum("phase"),
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
    index("ingestion_runs_source_provider_started_at_idx").on(t.sourceProvider, t.startedAt),
    index("ingestion_runs_status_idx").on(t.status),
    index("ingestion_runs_temporal_workflow_id_idx").on(t.temporalWorkflowId),
  ]
);

export const ingestionDiffs = pgTable(
  "ingestion_diffs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ingestionRunId: text("ingestion_run_id").notNull().references(() => ingestionRuns.id, { onDelete: "cascade" }),
    scope: ingestionDiffScopeEnum("scope").notNull(),
    entityType: text("entity_type").notNull(),
    externalSourceId: text("external_source_id"),
    diffType: text("diff_type").notNull(),
    payload: json("payload").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ingestion_diffs_ingestion_run_id_idx").on(t.ingestionRunId),
    index("ingestion_diffs_scope_entity_type_idx").on(t.scope, t.entityType),
  ]
);

export const ingestionSuggestions = pgTable(
  "ingestion_suggestions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ingestionRunId: text("ingestion_run_id").notNull().references(() => ingestionRuns.id, { onDelete: "cascade" }),
    type: ingestionSuggestionTypeEnum("type").notNull(),
    status: ingestionSuggestionStatusEnum("status").notNull().default("PENDING"),
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
    index("ingestion_suggestions_status_type_idx").on(t.status, t.type),
    index("ingestion_suggestions_facility_id_status_idx").on(t.facilityId, t.status),
    index("ingestion_suggestions_ingestion_run_id_idx").on(t.ingestionRunId),
  ]
);

// --- Relations ---

export const ingestionRunsRelations = relations(ingestionRuns, ({ many }) => ({
  suggestions: many(ingestionSuggestions),
  diffs: many(ingestionDiffs),
}));

export const ingestionDiffsRelations = relations(ingestionDiffs, ({ one }) => ({
  ingestionRun: one(ingestionRuns, {
    fields: [ingestionDiffs.ingestionRunId],
    references: [ingestionRuns.id],
  }),
}));

export const ingestionSuggestionsRelations = relations(ingestionSuggestions, ({ one }) => ({
  ingestionRun: one(ingestionRuns, {
    fields: [ingestionSuggestions.ingestionRunId],
    references: [ingestionRuns.id],
  }),
  facility: one(facilities, {
    fields: [ingestionSuggestions.facilityId],
    references: [facilities.id],
  }),
  professional: one(professionals, {
    fields: [ingestionSuggestions.professionalId],
    references: [professionals.id],
  }),
  facilityProfessional: one(facilityProfessionals, {
    fields: [ingestionSuggestions.facilityProfessionalId],
    references: [facilityProfessionals.id],
  }),
}));
