import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    kind: fieldSuggestionKindEnum("kind").notNull(),
    status: fieldSuggestionStatusEnum("status").notNull().default("PENDING"),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    /** Reserved for a later doctor-target increment; unused in v1. */
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "set null",
    }),
    /** Required for FIELD_CHANGE; null for DEACTIVATION. */
    fieldKey: text("field_key"),
    currentValue: jsonb("current_value").notNull().default({}),
    proposedValue: jsonb("proposed_value"),
    reason: text("reason"),
    submittedByUserId: text("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id, {
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
