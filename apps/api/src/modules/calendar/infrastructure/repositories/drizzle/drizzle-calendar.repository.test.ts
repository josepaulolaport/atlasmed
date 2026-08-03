import { describe, expect, it } from "bun:test";
import type { calendar } from "@atlasmed/database";
import { mapCalendarEvent } from "./drizzle-calendar.repository";

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

describe("DrizzleCalendarRepository mapping", () => {
  it("explicitly preserves nullable historical first occurrence instants", () => {
    expect(mapCalendarEvent(historicalRow)).toMatchObject({
      firstStartsAt: null,
      firstEndsAt: null,
      anchorLocalTime: "09:00",
    });
  });
});
