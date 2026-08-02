import { describe, expect, test } from "bun:test";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import {
  calendar,
  calendarEventKindEnum,
  calendarOccurrenceOverrides,
  calendarOccurrenceOverrideStatusEnum,
  calendarRecurrenceEnum,
  interactionEvents,
  interactionModalityEnum,
  interactions,
  interactionStatusEnum,
} from "./calendar";
import { orders } from "./orders";

const recurringMonthly = {
  ownerUserId: "user-1",
  kind: "INTERACTION" as const,
  title: "Atendimento",
  anchorLocalDate: "2026-01-31",
  anchorLocalTime: "09:00",
  timeZone: "America/Sao_Paulo",
  durationMinutes: 60,
  recurrence: "MONTHLY" as const,
} satisfies typeof calendar.$inferInsert;

const orderWithoutInteraction = {
  facilityId: "facility-1",
  verticalId: "vertical-1",
  orderedAt: new Date("2026-01-31T12:00:00.000Z"),
} satisfies typeof orders.$inferInsert;

const orderWithInteraction = {
  ...orderWithoutInteraction,
  interactionId: "interaction-1",
} satisfies typeof orders.$inferInsert;

const columnByName = (table: AnyPgTable, name: string) =>
  getTableConfig(table).columns.find((column) => column.name === name);

const foreignKeyByColumnName = (table: AnyPgTable, name: string) =>
  getTableConfig(table).foreignKeys.find((foreignKey) =>
    foreignKey.reference().columns.some((column) => column.name === name),
  );

const indexByName = (table: AnyPgTable, name: string) =>
  getTableConfig(table).indexes.find((candidate) => candidate.config.name === name);

const indexColumnNames = (table: AnyPgTable, name: string) =>
  indexByName(table, name)?.config.columns.map((column) =>
    "name" in column ? column.name : undefined,
  );

describe("calendar and interaction schema", () => {
  test("exports the approved enum values", () => {
    expect(calendarEventKindEnum.enumValues).toEqual(["INTERACTION", "PERSONAL_BLOCK"]);
    expect(calendarRecurrenceEnum.enumValues).toEqual([
      "NONE",
      "DAILY",
      "WEEKLY",
      "MONTHLY",
      "YEARLY",
    ]);
    expect(calendarOccurrenceOverrideStatusEnum.enumValues).toEqual(["ACTIVE", "CANCELLED"]);
    expect(interactionModalityEnum.enumValues).toEqual(["IN_PERSON", "REMOTE"]);
    expect(interactionStatusEnum.enumValues).toEqual([
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "NOT_COMPLETED",
      "CANCELLED",
    ]);
  });

  test("accepts the approved insert contracts", () => {
    expect(recurringMonthly).toMatchObject({
      recurrence: "MONTHLY",
      timeZone: "America/Sao_Paulo",
    });
    expect(orderWithoutInteraction).not.toHaveProperty("interactionId");
    expect(orderWithInteraction.interactionId).toBe("interaction-1");
  });

  test("uses the required physical table names", () => {
    expect([
      getTableConfig(calendar).name,
      getTableConfig(calendarOccurrenceOverrides).name,
      getTableConfig(interactions).name,
      getTableConfig(interactionEvents).name,
    ]).toEqual([
      "calendar",
      "calendar_occurrence_overrides",
      "interactions",
      "interaction_events",
    ]);
  });

  test("stores local recurrence anchors separately from UTC instants", () => {
    expect(
      [
        "owner_user_id",
        "kind",
        "title",
        "anchor_local_date",
        "anchor_local_time",
        "time_zone",
        "duration_minutes",
        "first_starts_at",
        "first_ends_at",
        "recurrence",
        "recurrence_until",
        "recurrence_count",
        "version",
        "created_at",
        "updated_at",
      ].map((name) => {
        const column = columnByName(calendar, name);
        return [column?.name, column?.getSQLType(), column?.notNull];
      }),
    ).toEqual([
      ["owner_user_id", "text", true],
      ["kind", "calendar_event_kind", true],
      ["title", "text", true],
      ["anchor_local_date", "date", true],
      ["anchor_local_time", "time", true],
      ["time_zone", "text", true],
      ["duration_minutes", "integer", true],
      ["first_starts_at", "timestamp with time zone", true],
      ["first_ends_at", "timestamp with time zone", true],
      ["recurrence", "calendar_recurrence", true],
      ["recurrence_until", "date", false],
      ["recurrence_count", "integer", false],
      ["version", "integer", true],
      ["created_at", "timestamp with time zone", true],
      ["updated_at", "timestamp with time zone", true],
    ]);

    for (const name of ["first_starts_at", "first_ends_at", "created_at", "updated_at"]) {
      expect(columnByName(calendar, name)).toMatchObject({ withTimezone: true });
    }
  });

  test("defaults first occurrence instants for the approved insert contract", () => {
    for (const name of ["first_starts_at", "first_ends_at"]) {
      expect(columnByName(calendar, name)).toMatchObject({ hasDefault: true });
    }
  });

  test("defines recurrence checks and owner/time indexes", () => {
    expect(getTableConfig(calendar).checks.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining([
        "calendar_duration_minutes_positive_check",
        "calendar_first_ends_after_starts_check",
        "calendar_recurrence_count_positive_check",
      ]),
    );
    expect(indexColumnNames(calendar, "calendar_owner_user_id_first_starts_at_idx")).toEqual([
      "owner_user_id",
      "first_starts_at",
    ]);
  });

  test("defines unique occurrence overrides with UTC override instants", () => {
    expect(
      ["calendar_id", "recurrence_key", "starts_at", "ends_at", "status", "reason", "version"].map(
        (name) => {
          const column = columnByName(calendarOccurrenceOverrides, name);
          return [column?.name, column?.getSQLType(), column?.notNull];
        },
      ),
    ).toEqual([
      ["calendar_id", "text", true],
      ["recurrence_key", "text", true],
      ["starts_at", "timestamp with time zone", true],
      ["ends_at", "timestamp with time zone", true],
      ["status", "calendar_occurrence_override_status", true],
      ["reason", "text", false],
      ["version", "integer", true],
    ]);

    const config = getTableConfig(calendarOccurrenceOverrides);
    expect(config.uniqueConstraints.map((candidate) => candidate.name)).toContain(
      "calendar_occurrence_overrides_calendar_id_recurrence_key_key",
    );
    expect(config.checks.map((candidate) => candidate.name)).toContain(
      "calendar_occurrence_overrides_ends_after_starts_check",
    );
    expect(indexColumnNames(calendarOccurrenceOverrides, "calendar_occurrence_overrides_calendar_id_starts_at_idx")).toEqual(
      ["calendar_id", "starts_at"],
    );
  });

  test("links interactions to occurrences, facilities, agents, and optional visits", () => {
    expect(
      [
        "calendar_id",
        "recurrence_key",
        "facility_id",
        "agent_user_id",
        "modality",
        "status",
        "actual_started_at",
        "actual_ended_at",
        "cancelled_at",
        "cancelled_by_user_id",
        "cancellation_reason",
        "corrected_at",
        "corrected_by_user_id",
        "correction_reason",
        "visit_id",
        "version",
        "created_at",
        "updated_at",
      ].map((name) => {
        const column = columnByName(interactions, name);
        return [column?.name, column?.getSQLType(), column?.notNull];
      }),
    ).toEqual([
      ["calendar_id", "text", true],
      ["recurrence_key", "text", true],
      ["facility_id", "text", true],
      ["agent_user_id", "text", true],
      ["modality", "interaction_modality", true],
      ["status", "interaction_status", true],
      ["actual_started_at", "timestamp with time zone", false],
      ["actual_ended_at", "timestamp with time zone", false],
      ["cancelled_at", "timestamp with time zone", false],
      ["cancelled_by_user_id", "text", false],
      ["cancellation_reason", "text", false],
      ["corrected_at", "timestamp with time zone", false],
      ["corrected_by_user_id", "text", false],
      ["correction_reason", "text", false],
      ["visit_id", "text", false],
      ["version", "integer", true],
      ["created_at", "timestamp with time zone", true],
      ["updated_at", "timestamp with time zone", true],
    ]);

    const config = getTableConfig(interactions);
    expect(config.uniqueConstraints.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining([
        "interactions_calendar_id_recurrence_key_key",
        "interactions_visit_id_key",
      ]),
    );
    expect(config.checks.map((candidate) => candidate.name)).toContain(
      "interactions_actual_ends_after_starts_check",
    );
    expect(indexColumnNames(interactions, "interactions_facility_id_status_idx")).toEqual([
      "facility_id",
      "status",
    ]);
    expect(indexColumnNames(interactions, "interactions_agent_user_id_status_idx")).toEqual([
      "agent_user_id",
      "status",
    ]);
  });

  test("stores append-only interaction lifecycle events", () => {
    expect(
      [
        "interaction_id",
        "actor_user_id",
        "previous_status",
        "new_status",
        "reason",
        "metadata",
        "created_at",
      ].map((name) => {
        const column = columnByName(interactionEvents, name);
        return [column?.name, column?.getSQLType(), column?.notNull];
      }),
    ).toEqual([
      ["interaction_id", "text", true],
      ["actor_user_id", "text", true],
      ["previous_status", "interaction_status", false],
      ["new_status", "interaction_status", true],
      ["reason", "text", false],
      ["metadata", "jsonb", true],
      ["created_at", "timestamp with time zone", true],
    ]);
    expect(indexColumnNames(interactionEvents, "interaction_events_interaction_id_created_at_idx")).toEqual([
      "interaction_id",
      "created_at",
    ]);
  });

  test("restricts deletion across business-history foreign keys", () => {
    expect([
      foreignKeyByColumnName(calendar, "owner_user_id")?.onDelete,
      foreignKeyByColumnName(calendarOccurrenceOverrides, "calendar_id")?.onDelete,
      foreignKeyByColumnName(interactions, "calendar_id")?.onDelete,
      foreignKeyByColumnName(interactionEvents, "interaction_id")?.onDelete,
      foreignKeyByColumnName(orders, "interaction_id")?.onDelete,
    ]).toEqual(["restrict", "restrict", "restrict", "restrict", "restrict"]);
  });

  test("adds an optional indexed interaction link to orders", () => {
    const interactionId = columnByName(orders, "interaction_id");
    expect(interactionId).toMatchObject({ notNull: false });
    expect(indexColumnNames(orders, "orders_interaction_id_idx")).toEqual(["interaction_id"]);
  });
});
