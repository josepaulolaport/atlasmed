import { describe, expect, it } from "bun:test";
import { calendar, interactionEvents, interactions, type AnyDatabase } from "@atlasmed/database";
import { DrizzleCalendarRepository, mapCalendarEvent } from "./drizzle-calendar.repository";

const historicalRow = {
  id: "calendar-historical",
  ownerUserId: "rep-1",
  kind: "PERSONAL_BLOCK",
  title: "Histórico",
  anchorLocalDate: "2026-08-03",
  anchorLocalTime: "09:00:00",
  timeZone: "UTC",
  durationMinutes: 60,
  firstStartsAt: null,
  firstEndsAt: null,
  recurrence: "NONE",
  recurrenceUntil: null,
  recurrenceCount: null,
  status: "ACTIVE",
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  version: 1,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
} satisfies typeof calendar.$inferSelect;

function repositoryDatabase(input: { eventRows?: Array<Record<string, unknown>> }) {
  const deletedTables: unknown[] = [];
  const updatedRecurrenceKeys: string[] = [];
  let selectedTable: unknown;
  const eventRows = input.eventRows ?? [];

  const database = {
    select() {
      return {
        from(table: unknown) {
          selectedTable = table;
          const query = {
            where() { return query; },
            for() {
              if (selectedTable === interactions) {
                return Promise.resolve([
                  {
                    id: "interaction-1",
                    calendarId: "calendar-1",
                    recurrenceKey: "2026-08-03T09:00[UTC]",
                    facilityId: "facility-1",
                    agentUserId: "rep-1",
                    modality: "REMOTE",
                    status: "SCHEDULED",
                    actualStartedAt: null,
                    actualEndedAt: null,
                    cancelledAt: null,
                    cancelledByUserId: null,
                    cancellationReason: null,
                    correctedAt: null,
                    correctedByUserId: null,
                    correctionReason: null,
                    visitId: null,
                    version: 1,
                    createdAt: new Date("2026-08-01T00:00:00Z"),
                    updatedAt: new Date("2026-08-01T00:00:00Z"),
                  },
                ]);
              }
              return Promise.resolve([]);
            },
            groupBy() { return Promise.resolve([]); },
            then(resolve: (rows: Array<Record<string, unknown>>) => unknown) {
              return Promise.resolve(selectedTable === interactionEvents ? eventRows : []).then(resolve);
            },
          };
          return query;
        },
      };
    },
    update(table: unknown) {
      expect(table).toBe(interactions);
      return {
        set(values: { recurrenceKey: string }) {
          updatedRecurrenceKeys.push(values.recurrenceKey);
          return { where: async () => [] };
        },
      };
    },
    delete(table: unknown) {
      deletedTables.push(table);
      return { where: async () => [] };
    },
  } as unknown as AnyDatabase;

  return { database, deletedTables, updatedRecurrenceKeys };
}

describe("DrizzleCalendarRepository mapping", () => {
  it("explicitly preserves nullable historical first occurrence instants", () => {
    expect(mapCalendarEvent(historicalRow)).toMatchObject({
      firstStartsAt: null,
      firstEndsAt: null,
      anchorLocalTime: "09:00",
    });
  });
});

describe("DrizzleCalendarRepository.replaceUntouchedInteractions", () => {
  it("rekeys an untouched interaction with no lifecycle events without deleting event history", async () => {
    const { database, deletedTables, updatedRecurrenceKeys } = repositoryDatabase({});
    const repository = new DrizzleCalendarRepository(database);

    const replaced = await repository.replaceUntouchedInteractions({
      calendarId: "calendar-1",
      recurrenceKeys: ["2026-08-03T10:00[UTC]"],
    });

    expect(replaced).toBe(true);
    expect(deletedTables).not.toContain(interactionEvents);
    expect(updatedRecurrenceKeys).toEqual([
      "__calendar_rekey__0__interaction-1",
      "2026-08-03T10:00[UTC]",
    ]);
  });

  it("rejects rekeying when any append-only lifecycle event exists without deleting it", async () => {
    const { database, deletedTables, updatedRecurrenceKeys } = repositoryDatabase({
      eventRows: [{ interactionId: "interaction-1", previousStatus: null, newStatus: "SCHEDULED" }],
    });
    const repository = new DrizzleCalendarRepository(database);

    const replaced = await repository.replaceUntouchedInteractions({
      calendarId: "calendar-1",
      recurrenceKeys: ["2026-08-03T10:00[UTC]"],
    });

    expect(replaced).toBe(false);
    expect(deletedTables).not.toContain(interactionEvents);
    expect(updatedRecurrenceKeys).toEqual([]);
  });
});
