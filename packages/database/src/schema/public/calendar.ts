import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { users } from "./users";
import { visits } from "./visits";

export const calendarEventKindEnum = pgEnum("calendar_event_kind", [
  "INTERACTION",
  "PERSONAL_BLOCK",
]);

export const calendarRecurrenceEnum = pgEnum("calendar_recurrence", [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const calendarOccurrenceOverrideStatusEnum = pgEnum(
  "calendar_occurrence_override_status",
  ["ACTIVE", "CANCELLED"],
);

export const interactionModalityEnum = pgEnum("interaction_modality", [
  "IN_PERSON",
  "REMOTE",
]);

export const interactionStatusEnum = pgEnum("interaction_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "NOT_COMPLETED",
  "CANCELLED",
]);

export const calendar = pgTable(
  "calendar",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: calendarEventKindEnum("kind").notNull(),
    title: text("title").notNull(),
    anchorLocalDate: date("anchor_local_date").notNull(),
    anchorLocalTime: time("anchor_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    firstStartsAt: timestamp("first_starts_at", { withTimezone: true }).notNull().defaultNow(),
    firstEndsAt: timestamp("first_ends_at", { withTimezone: true }).notNull().defaultNow(),
    recurrence: calendarRecurrenceEnum("recurrence").notNull().default("NONE"),
    recurrenceUntil: date("recurrence_until"),
    recurrenceCount: integer("recurrence_count"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("calendar_duration_minutes_positive_check", sql`${t.durationMinutes} > 0`),
    check("calendar_first_ends_after_starts_check", sql`${t.firstEndsAt} > ${t.firstStartsAt}`),
    check(
      "calendar_recurrence_count_positive_check",
      sql`${t.recurrenceCount} is null or ${t.recurrenceCount} > 0`,
    ),
    index("calendar_owner_user_id_first_starts_at_idx").on(t.ownerUserId, t.firstStartsAt),
    index("calendar_owner_user_id_kind_first_starts_at_idx").on(
      t.ownerUserId,
      t.kind,
      t.firstStartsAt,
    ),
  ],
);

export const calendarOccurrenceOverrides = pgTable(
  "calendar_occurrence_overrides",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "restrict" }),
    recurrenceKey: text("recurrence_key").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: calendarOccurrenceOverrideStatusEnum("status").notNull().default("ACTIVE"),
    reason: text("reason"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("calendar_occurrence_overrides_calendar_id_recurrence_key_key").on(
      t.calendarId,
      t.recurrenceKey,
    ),
    check(
      "calendar_occurrence_overrides_ends_after_starts_check",
      sql`${t.endsAt} > ${t.startsAt}`,
    ),
    index("calendar_occurrence_overrides_calendar_id_starts_at_idx").on(
      t.calendarId,
      t.startsAt,
    ),
    index("calendar_occurrence_overrides_status_starts_at_idx").on(t.status, t.startsAt),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "restrict" }),
    recurrenceKey: text("recurrence_key").notNull(),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    agentUserId: text("agent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    modality: interactionModalityEnum("modality").notNull(),
    status: interactionStatusEnum("status").notNull().default("SCHEDULED"),
    actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
    actualEndedAt: timestamp("actual_ended_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: text("cancelled_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    cancellationReason: text("cancellation_reason"),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctedByUserId: text("corrected_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    correctionReason: text("correction_reason"),
    visitId: text("visit_id").references(() => visits.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("interactions_calendar_id_recurrence_key_key").on(t.calendarId, t.recurrenceKey),
    unique("interactions_visit_id_key").on(t.visitId),
    check(
      "interactions_actual_ends_after_starts_check",
      sql`${t.actualEndedAt} is null or (${t.actualStartedAt} is not null and ${t.actualEndedAt} > ${t.actualStartedAt})`,
    ),
    index("interactions_calendar_id_recurrence_key_idx").on(t.calendarId, t.recurrenceKey),
    index("interactions_facility_id_status_idx").on(t.facilityId, t.status),
    index("interactions_agent_user_id_status_idx").on(t.agentUserId, t.status),
    index("interactions_status_idx").on(t.status),
  ],
);

export const interactionEvents = pgTable(
  "interaction_events",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    interactionId: text("interaction_id")
      .notNull()
      .references(() => interactions.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    previousStatus: interactionStatusEnum("previous_status"),
    newStatus: interactionStatusEnum("new_status").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interaction_events_interaction_id_created_at_idx").on(
      t.interactionId,
      t.createdAt,
    ),
    index("interaction_events_actor_user_id_created_at_idx").on(t.actorUserId, t.createdAt),
  ],
);

export const calendarRelations = relations(calendar, ({ one, many }) => ({
  owner: one(users, {
    fields: [calendar.ownerUserId],
    references: [users.id],
    relationName: "calendarOwner",
  }),
  occurrenceOverrides: many(calendarOccurrenceOverrides),
  interactions: many(interactions),
}));

export const calendarOccurrenceOverridesRelations = relations(
  calendarOccurrenceOverrides,
  ({ one }) => ({
    calendar: one(calendar, {
      fields: [calendarOccurrenceOverrides.calendarId],
      references: [calendar.id],
    }),
  }),
);

export const interactionsRelations = relations(interactions, ({ one, many }) => ({
  calendar: one(calendar, {
    fields: [interactions.calendarId],
    references: [calendar.id],
  }),
  facility: one(facilities, {
    fields: [interactions.facilityId],
    references: [facilities.id],
  }),
  agent: one(users, {
    fields: [interactions.agentUserId],
    references: [users.id],
    relationName: "interactionAgent",
  }),
  cancelledBy: one(users, {
    fields: [interactions.cancelledByUserId],
    references: [users.id],
    relationName: "interactionCancelledBy",
  }),
  correctedBy: one(users, {
    fields: [interactions.correctedByUserId],
    references: [users.id],
    relationName: "interactionCorrectedBy",
  }),
  visit: one(visits, {
    fields: [interactions.visitId],
    references: [visits.id],
  }),
  events: many(interactionEvents),
}));

export const interactionEventsRelations = relations(interactionEvents, ({ one }) => ({
  interaction: one(interactions, {
    fields: [interactionEvents.interactionId],
    references: [interactions.id],
  }),
  actor: one(users, {
    fields: [interactionEvents.actorUserId],
    references: [users.id],
    relationName: "interactionEventActor",
  }),
}));
