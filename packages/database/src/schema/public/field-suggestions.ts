import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  fieldSuggestionKindEnum,
  fieldSuggestionStatusEnum,
} from "./enums";
import { facilities, professionals } from "./facilities";
import { users } from "./users";

/**
 * User-submitted facility suggestions (Não Conformidades).
 * Independent of ingestion.cnes_suggestions / CNES registry review.
 */
export const fieldSuggestions = pgTable(
  "field_suggestions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    kind: fieldSuggestionKindEnum("kind").notNull(),
    status: fieldSuggestionStatusEnum("status").notNull().default("PENDING"),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    /** Reserved for a later doctor-target increment; unused in v1. */
    professionalId: bigint("professional_id", { mode: "number" }).references(() => professionals.id, {
      onDelete: "set null",
    }),
    /** Required for FIELD_CHANGE; null for DEACTIVATION. */
    fieldKey: text("field_key"),
    currentValue: jsonb("current_value").notNull().default({}),
    proposedValue: jsonb("proposed_value"),
    reason: text("reason"),
    submittedByUserId: bigint("submitted_by_user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: bigint("resolved_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("field_suggestions_status_submitted_at_idx").on(
      t.status,
      t.submittedAt
    ),
    index("field_suggestions_facility_submitter_submitted_at_idx").on(
      t.facilityId,
      t.submittedByUserId,
      t.submittedAt
    ),
    index("field_suggestions_facility_field_status_idx").on(
      t.facilityId,
      t.fieldKey,
      t.status
    ),
    index("field_suggestions_facility_kind_status_idx").on(
      t.facilityId,
      t.kind,
      t.status
    ),
  ]
);

export const fieldSuggestionsRelations = relations(fieldSuggestions, ({ one }) => ({
  facility: one(facilities, {
    fields: [fieldSuggestions.facilityId],
    references: [facilities.id],
  }),
  professional: one(professionals, {
    fields: [fieldSuggestions.professionalId],
    references: [professionals.id],
  }),
  submittedBy: one(users, {
    fields: [fieldSuggestions.submittedByUserId],
    references: [users.id],
    relationName: "FieldSuggestionSubmittedBy",
  }),
  resolvedBy: one(users, {
    fields: [fieldSuggestions.resolvedByUserId],
    references: [users.id],
    relationName: "FieldSuggestionResolvedBy",
  }),
}));
