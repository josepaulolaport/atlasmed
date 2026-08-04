import { describe, expect, test } from "bun:test";
import { getTableConfig, PgDialect, type AnyPgTable } from "drizzle-orm/pg-core";
import {
  calendar,
  calendarCommandReceipts,
  calendarEventKindEnum,
  calendarOccurrenceOverrides,
  calendarOccurrenceStatusEnum,
  calendarRecurrenceEnum,
  calendarStatusEnum,
  interactionEventSourceEnum,
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

const pgDialect = new PgDialect();

const checkSqlByName = (table: AnyPgTable, name: string) => {
  const candidate = getTableConfig(table).checks.find((check) => check.name === name);
  return candidate ? pgDialect.sqlToQuery(candidate.value).sql : undefined;
};

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
    expect(calendarStatusEnum.enumValues).toEqual(["ACTIVE", "CANCELLED"]);
    expect(calendarOccurrenceStatusEnum.enumName).toBe("calendar_occurrence_status");
    expect(calendarOccurrenceStatusEnum.enumValues).toEqual(["ACTIVE", "CANCELLED"]);
    expect(interactionModalityEnum.enumValues).toEqual(["IN_PERSON", "REMOTE"]);
    expect(interactionEventSourceEnum.enumValues).toEqual(["USER", "SYSTEM"]);
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
      getTableConfig(calendarCommandReceipts).name,
    ]).toEqual([
      "calendar",
      "calendar_occurrence_overrides",
      "interactions",
      "interaction_events",
      "calendar_command_receipts",
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
        "status",
        "cancelled_at",
        "cancelled_by_user_id",
        "cancellation_reason",
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
      ["first_starts_at", "timestamp with time zone", false],
      ["first_ends_at", "timestamp with time zone", false],
      ["recurrence", "calendar_recurrence", true],
      ["recurrence_until", "date", false],
      ["recurrence_count", "integer", false],
      ["status", "calendar_status", true],
      ["cancelled_at", "timestamp with time zone", false],
      ["cancelled_by_user_id", "text", false],
      ["cancellation_reason", "text", false],
      ["version", "integer", true],
      ["created_at", "timestamp with time zone", true],
      ["updated_at", "timestamp with time zone", true],
    ]);

    for (const name of ["first_starts_at", "first_ends_at", "created_at", "updated_at"]) {
      expect(columnByName(calendar, name)).toMatchObject({ withTimezone: true });
    }
  });

  test("keeps first occurrence instants insert-optional without independent defaults", () => {
    for (const name of ["first_starts_at", "first_ends_at"]) {
      expect(columnByName(calendar, name)).toMatchObject({ hasDefault: false, notNull: false });
    }
  });

  test("defines coherent first-occurrence and recurrence checks", () => {
    expect(checkSqlByName(calendar, "calendar_first_occurrence_instants_check")).toBe(
      '("calendar"."first_starts_at" is null and "calendar"."first_ends_at" is null) or ("calendar"."first_starts_at" is not null and "calendar"."first_ends_at" is not null and "calendar"."first_ends_at" > "calendar"."first_starts_at" and "calendar"."first_ends_at" - "calendar"."first_starts_at" = "calendar"."duration_minutes" * interval \'1 minute\')',
    );
    expect(checkSqlByName(calendar, "calendar_recurrence_until_anchor_check")).toBe(
      '"calendar"."recurrence_until" is null or "calendar"."recurrence_until" >= "calendar"."anchor_local_date"',
    );
    expect(checkSqlByName(calendar, "calendar_recurrence_none_bounds_check")).toBe(
      '"calendar"."recurrence" <> \'NONE\' or ("calendar"."recurrence_until" is null and "calendar"."recurrence_count" is null)',
    );
    expect(checkSqlByName(calendar, "calendar_recurrence_bounds_mutually_exclusive_check")).toBe(
      '"calendar"."recurrence_until" is null or "calendar"."recurrence_count" is null',
    );
    expect(checkSqlByName(calendar, "calendar_recurrence_count_positive_check")).toBe(
      '"calendar"."recurrence_count" is null or "calendar"."recurrence_count" > 0',
    );
  });

  test("preserves calendar series cancellation metadata coherently", () => {
    expect(checkSqlByName(calendar, "calendar_cancellation_metadata_check")).toBe(
      '("calendar"."status" = \'ACTIVE\' and "calendar"."cancelled_at" is null and "calendar"."cancelled_by_user_id" is null and "calendar"."cancellation_reason" is null) or ("calendar"."status" = \'CANCELLED\' and "calendar"."cancelled_at" is not null and "calendar"."cancelled_by_user_id" is not null and "calendar"."cancellation_reason" is not null and btrim("calendar"."cancellation_reason") <> \'\')',
    );
    expect(foreignKeyByColumnName(calendar, "cancelled_by_user_id")?.onDelete).toBe("restrict");
  });

  test("defines owner/time indexes", () => {
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
      ["status", "calendar_occurrence_status", true],
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
    expect(checkSqlByName(interactions, "interactions_actual_ends_after_starts_check")).toBeDefined();
    expect(checkSqlByName(interactions, "interactions_cancellation_metadata_check")).toBe(
      '("interactions"."cancelled_at" is null and "interactions"."cancelled_by_user_id" is null and "interactions"."cancellation_reason" is null) or ("interactions"."cancelled_at" is not null and "interactions"."cancelled_by_user_id" is not null and "interactions"."cancellation_reason" is not null and btrim("interactions"."cancellation_reason") <> \'\' and "interactions"."status" = \'CANCELLED\')',
    );
    expect(checkSqlByName(interactions, "interactions_correction_metadata_check")).toBe(
      '("interactions"."corrected_at" is null and "interactions"."corrected_by_user_id" is null and "interactions"."correction_reason" is null) or ("interactions"."corrected_at" is not null and "interactions"."corrected_by_user_id" is not null and "interactions"."correction_reason" is not null and btrim("interactions"."correction_reason") <> \'\' and "interactions"."status" = \'COMPLETED\')',
    );
    expect(indexByName(interactions, "interactions_calendar_id_recurrence_key_idx")).toBeUndefined();
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
        "source",
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
      ["actor_user_id", "text", false],
      ["source", "interaction_event_source", true],
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
    expect(foreignKeyByColumnName(interactionEvents, "actor_user_id")?.onDelete).toBe("restrict");
  });

  test("stores durable owner-scoped command receipts", () => {
    expect(
      ["owner_user_id", "command_key", "command_kind", "resource_id", "request_fingerprint", "result", "created_at"].map(
        (name) => {
          const column = columnByName(calendarCommandReceipts, name);
          return [column?.name, column?.getSQLType(), column?.notNull];
        },
      ),
    ).toEqual([
      ["owner_user_id", "text", true],
      ["command_key", "text", true],
      ["command_kind", "text", true],
      ["resource_id", "text", false],
      ["request_fingerprint", "text", true],
      ["result", "jsonb", true],
      ["created_at", "timestamp with time zone", true],
    ]);
    const config = getTableConfig(calendarCommandReceipts);
    expect(config.uniqueConstraints.map((candidate) => candidate.name)).toContain(
      "calendar_command_receipts_owner_user_id_command_key_key",
    );
    expect(foreignKeyByColumnName(calendarCommandReceipts, "owner_user_id")?.onDelete).toBe("restrict");
  });

  test("restricts deletion across business-history foreign keys", () => {
    expect([
      foreignKeyByColumnName(calendar, "owner_user_id")?.onDelete,
      foreignKeyByColumnName(calendarOccurrenceOverrides, "calendar_id")?.onDelete,
      foreignKeyByColumnName(interactions, "calendar_id")?.onDelete,
      foreignKeyByColumnName(interactions, "facility_id")?.onDelete,
      foreignKeyByColumnName(interactions, "agent_user_id")?.onDelete,
      foreignKeyByColumnName(interactions, "cancelled_by_user_id")?.onDelete,
      foreignKeyByColumnName(interactions, "corrected_by_user_id")?.onDelete,
      foreignKeyByColumnName(interactions, "visit_id")?.onDelete,
      foreignKeyByColumnName(interactionEvents, "interaction_id")?.onDelete,
      foreignKeyByColumnName(orders, "interaction_id")?.onDelete,
    ]).toEqual([
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
      "restrict",
    ]);
  });

  test("adds an optional indexed interaction link to orders", () => {
    const interactionId = columnByName(orders, "interaction_id");
    expect(interactionId).toMatchObject({ notNull: false });
    expect(indexColumnNames(orders, "orders_interaction_id_idx")).toEqual(["interaction_id"]);
  });
});
