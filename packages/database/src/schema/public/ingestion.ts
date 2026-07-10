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
    sourceProvider: text("sourceProvider").notNull(),
    status: ingestionRunStatusEnum("status").notNull().default("RUNNING"),
    phase: ingestionRunPhaseEnum("phase"),
    phaseStartedAt: timestamp("phaseStartedAt"),
    temporalWorkflowId: text("temporalWorkflowId"),
    referenceAno: integer("referenceAno"),
    referenceMes: integer("referenceMes"),
    startedAt: timestamp("startedAt").notNull().defaultNow(),
    completedAt: timestamp("completedAt"),
    promotedAt: timestamp("promotedAt"),
    stats: json("stats"),
    validationReport: json("validationReport"),
    archiveManifest: json("archiveManifest"),
    error: text("error"),
  },
  (t) => [
    index("ingestion_runs_sourceProvider_startedAt_idx").on(t.sourceProvider, t.startedAt),
    index("ingestion_runs_status_idx").on(t.status),
    index("ingestion_runs_temporalWorkflowId_idx").on(t.temporalWorkflowId),
  ]
);

export const ingestionDiffs = pgTable(
  "ingestion_diffs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ingestionRunId: text("ingestionRunId").notNull().references(() => ingestionRuns.id, { onDelete: "cascade" }),
    scope: ingestionDiffScopeEnum("scope").notNull(),
    entityType: text("entityType").notNull(),
    externalSourceId: text("externalSourceId"),
    diffType: text("diffType").notNull(),
    payload: json("payload").notNull().default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("ingestion_diffs_ingestionRunId_idx").on(t.ingestionRunId),
    index("ingestion_diffs_scope_entityType_idx").on(t.scope, t.entityType),
  ]
);

export const ingestionSuggestions = pgTable(
  "ingestion_suggestions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ingestionRunId: text("ingestionRunId").notNull().references(() => ingestionRuns.id, { onDelete: "cascade" }),
    type: ingestionSuggestionTypeEnum("type").notNull(),
    status: ingestionSuggestionStatusEnum("status").notNull().default("PENDING"),
    facilityId: text("facilityId").references(() => facilities.id, { onDelete: "set null" }),
    professionalId: text("professionalId").references(() => professionals.id, { onDelete: "set null" }),
    facilityProfessionalId: text("facilityProfessionalId").references(() => facilityProfessionals.id, { onDelete: "set null" }),
    reason: text("reason"),
    payload: json("payload").notNull().default({}),
    suggestedAt: timestamp("suggestedAt").notNull().defaultNow(),
    resolvedAt: timestamp("resolvedAt"),
    resolvedByUserId: text("resolvedByUserId"),
    resolutionNote: text("resolutionNote"),
  },
  (t) => [
    index("ingestion_suggestions_status_type_idx").on(t.status, t.type),
    index("ingestion_suggestions_facilityId_status_idx").on(t.facilityId, t.status),
    index("ingestion_suggestions_ingestionRunId_idx").on(t.ingestionRunId),
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
