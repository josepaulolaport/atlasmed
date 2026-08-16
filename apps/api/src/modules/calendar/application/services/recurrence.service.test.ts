import { describe, expect, it } from "bun:test";
import {
  expandCalendarOccurrences,
  mapCalendarRecurrenceKey,
  type CalendarRecurrenceRule,
} from "./recurrence.service";

function rule(
  overrides: Partial<CalendarRecurrenceRule> = {}
): CalendarRecurrenceRule {
  return {
    anchorLocalDate: "2026-01-15",
    anchorLocalTime: "09:30",
    timeZone: "UTC",
    durationMinutes: 60,
    recurrence: "NONE",
    ...overrides,
  };
}

function isoDates(occurrences: ReturnType<typeof expandCalendarOccurrences>) {
  return occurrences.map((occurrence) => occurrence.startsAt.toISOString());
}

describe("WEEKDAYS expansion", () => {
  // 2026-01-15 is a Thursday.
  const localDates = (occurrences: ReturnType<typeof expandCalendarOccurrences>) =>
    occurrences.map((o) => o.localOccurrence.slice(0, 10));

  it("skips the weekend and picks up on Monday", () => {
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKDAYS" }),
      { from: new Date("2026-01-15T00:00:00Z"), to: new Date("2026-01-22T00:00:00Z") },
    );

    expect(localDates(occurrences)).toEqual([
      "2026-01-15", // Thu
      "2026-01-16", // Fri
      "2026-01-19", // Mon — 17th and 18th are the weekend
      "2026-01-20",
      "2026-01-21",
    ]);
  });

  it("counts occurrences in weekdays, not in days", () => {
    // Five occurrences from a Thursday reach the following Wednesday.
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKDAYS", recurrenceCount: 5 }),
      { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-03-01T00:00:00Z") },
    );

    expect(localDates(occurrences)).toEqual([
      "2026-01-15",
      "2026-01-16",
      "2026-01-19",
      "2026-01-20",
      "2026-01-21",
    ]);
  });

  it("starts on the Monday when the anchor lands on a weekend", () => {
    // A rep can draw a block on a Saturday and ask for it every weekday. Every
    // other recurrence has occurrence zero on the anchor date; this is the one
    // that cannot.
    const occurrences = expandCalendarOccurrences(
      rule({ anchorLocalDate: "2026-01-17", recurrence: "WEEKDAYS" }), // Saturday
      { from: new Date("2026-01-17T00:00:00Z"), to: new Date("2026-01-21T00:00:00Z") },
    );

    expect(localDates(occurrences)).toEqual([
      "2026-01-19",
      "2026-01-20",
    ]);
  });

  it("expands a window that starts months after the anchor", () => {
    // The window is found by estimate-then-walk, and the two estimates lean in
    // opposite directions on purpose. A range far from the anchor is where a
    // lean in the wrong direction shows up as missing or duplicated days.
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKDAYS" }),
      { from: new Date("2026-06-01T00:00:00Z"), to: new Date("2026-06-08T00:00:00Z") },
    );

    expect(localDates(occurrences)).toEqual([
      "2026-06-01", // Mon
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05", // Fri
    ]);
  });

  it("honours an until date", () => {
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKDAYS", recurrenceUntil: "2026-01-19" }),
      { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-02-01T00:00:00Z") },
    );

    expect(localDates(occurrences)).toEqual([
      "2026-01-15",
      "2026-01-16",
      "2026-01-19",
    ]);
  });

  it("never lands on a Saturday or Sunday, over a long run", () => {
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKDAYS" }),
      { from: new Date("2026-01-15T00:00:00Z"), to: new Date("2026-12-31T00:00:00Z") },
    );

    const weekend = occurrences.filter((o) => {
      const day = new Date(`${o.localOccurrence.slice(0, 10)}T00:00:00Z`).getUTCDay();
      return day === 0 || day === 6;
    });

    expect(weekend).toEqual([]);
    // 2026-01-15 to 2026-12-30 inclusive is 250 weekdays.
    expect(occurrences).toHaveLength(250);
  });
});

describe("mapCalendarRecurrenceKey", () => {
  it("maps by old occurrence ordinal instead of by materialized row count", () => {
    const oldRule = rule({ recurrence: "DAILY", recurrenceCount: 3 });
    const nextRule = rule({ anchorLocalTime: "10:00", recurrence: "DAILY", recurrenceCount: 3 });

    expect(mapCalendarRecurrenceKey(oldRule, nextRule, "2026-01-17T09:30[UTC]")).toBe("2026-01-17T10:00[UTC]");
  });

  it("returns undefined when the old materialized occurrence has no corresponding new ordinal", () => {
    expect(mapCalendarRecurrenceKey(
      rule({ recurrence: "DAILY", recurrenceCount: 3 }),
      rule({ recurrence: "NONE" }),
      "2026-01-17T09:30[UTC]",
    )).toBeUndefined();
  });
});

describe("expandCalendarOccurrences", () => {
  it("expands a one-off occurrence with deterministic local identity", () => {
    const occurrences = expandCalendarOccurrences(rule(), {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(occurrences).toEqual([
      {
        recurrenceKey: "2026-01-15T09:30[UTC]",
        localOccurrence: "2026-01-15T09:30",
        startsAt: new Date("2026-01-15T09:30:00.000Z"),
        endsAt: new Date("2026-01-15T10:30:00.000Z"),
      },
    ]);
  });

  it("uses interval intersection with a semi-open requested range", () => {
    const intersecting = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2026-01-15",
        anchorLocalTime: "09:30",
        durationMinutes: 60,
      }),
      {
        from: new Date("2026-01-15T10:00:00.000Z"),
        to: new Date("2026-01-15T11:00:00.000Z"),
      }
    );
    const endingAtFrom = expandCalendarOccurrences(
      rule({ anchorLocalTime: "09:00", durationMinutes: 60 }),
      {
        from: new Date("2026-01-15T10:00:00.000Z"),
        to: new Date("2026-01-15T11:00:00.000Z"),
      }
    );
    const startingAtTo = expandCalendarOccurrences(
      rule({ anchorLocalTime: "11:00" }),
      {
        from: new Date("2026-01-15T10:00:00.000Z"),
        to: new Date("2026-01-15T11:00:00.000Z"),
      }
    );

    expect(intersecting).toHaveLength(1);
    expect(endingAtFrom).toHaveLength(0);
    expect(startingAtTo).toHaveLength(0);
  });

  it("expands daily recurrences and applies count from the anchor", () => {
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "DAILY", recurrenceCount: 3 }),
      {
        from: new Date("2026-01-16T00:00:00.000Z"),
        to: new Date("2026-01-20T00:00:00.000Z"),
      }
    );

    expect(isoDates(occurrences)).toEqual([
      "2026-01-16T09:30:00.000Z",
      "2026-01-17T09:30:00.000Z",
    ]);
  });

  it("treats recurrenceUntil as an inclusive local date", () => {
    const occurrences = expandCalendarOccurrences(
      rule({
        recurrence: "DAILY",
        recurrenceUntil: "2026-01-17",
      }),
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-20T00:00:00.000Z"),
      }
    );

    expect(isoDates(occurrences)).toEqual([
      "2026-01-15T09:30:00.000Z",
      "2026-01-16T09:30:00.000Z",
      "2026-01-17T09:30:00.000Z",
    ]);
  });

  it("expands weekly recurrences on the anchor weekday and time", () => {
    const occurrences = expandCalendarOccurrences(
      rule({ recurrence: "WEEKLY", recurrenceCount: 3 }),
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-15T00:00:00.000Z"),
      }
    );

    expect(isoDates(occurrences)).toEqual([
      "2026-01-15T09:30:00.000Z",
      "2026-01-22T09:30:00.000Z",
      "2026-01-29T09:30:00.000Z",
    ]);
  });

  it("clamps monthly anchors to the last day and restores the anchor day", () => {
    const occurrences = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2025-01-31",
        recurrence: "MONTHLY",
        recurrenceCount: 4,
      }),
      {
        from: new Date("2025-01-01T00:00:00.000Z"),
        to: new Date("2025-06-01T00:00:00.000Z"),
      }
    );

    expect(occurrences.map((occurrence) => occurrence.localOccurrence)).toEqual([
      "2025-01-31T09:30",
      "2025-02-28T09:30",
      "2025-03-31T09:30",
      "2025-04-30T09:30",
    ]);
  });

  it("uses leap-year February when clamping monthly day 29 or 30", () => {
    const day29 = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2024-01-29",
        recurrence: "MONTHLY",
        recurrenceCount: 2,
      }),
      {
        from: new Date("2024-01-01T00:00:00.000Z"),
        to: new Date("2024-03-01T00:00:00.000Z"),
      }
    );
    const day30 = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2023-01-30",
        recurrence: "MONTHLY",
        recurrenceCount: 2,
      }),
      {
        from: new Date("2023-01-01T00:00:00.000Z"),
        to: new Date("2023-03-01T00:00:00.000Z"),
      }
    );

    expect(day29[1]?.localOccurrence).toBe("2024-02-29T09:30");
    expect(day30[1]?.localOccurrence).toBe("2023-02-28T09:30");
  });

  it("clamps yearly Feb 29 to Feb 28 and restores Feb 29 in leap years", () => {
    const occurrences = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2024-02-29",
        recurrence: "YEARLY",
        recurrenceCount: 5,
      }),
      {
        from: new Date("2024-01-01T00:00:00.000Z"),
        to: new Date("2029-01-01T00:00:00.000Z"),
      }
    );

    expect(occurrences.map((occurrence) => occurrence.localOccurrence)).toEqual([
      "2024-02-29T09:30",
      "2025-02-28T09:30",
      "2026-02-28T09:30",
      "2027-02-28T09:30",
      "2028-02-29T09:30",
    ]);
  });

  it("preserves wall-clock time across daylight-saving transitions", () => {
    const occurrences = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "2026-03-07",
        anchorLocalTime: "09:00",
        timeZone: "America/New_York",
        recurrence: "DAILY",
        recurrenceCount: 3,
      }),
      {
        from: new Date("2026-03-07T00:00:00.000Z"),
        to: new Date("2026-03-10T00:00:00.000Z"),
      }
    );

    expect(occurrences.map((occurrence) => occurrence.localOccurrence)).toEqual([
      "2026-03-07T09:00",
      "2026-03-08T09:00",
      "2026-03-09T09:00",
    ]);
    expect(isoDates(occurrences)).toEqual([
      "2026-03-07T14:00:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
    ]);
  });

  it("returns an empty expansion when the requested range ends before it starts", () => {
    expect(
      expandCalendarOccurrences(rule(), {
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual([]);
  });

  it("skips directly into a very large finite daily series", () => {
    const startedAt = performance.now();
    const occurrences = expandCalendarOccurrences(
      rule({
        anchorLocalDate: "0001-01-01",
        recurrence: "DAILY",
        recurrenceCount: 3_000_000,
      }),
      {
        from: new Date("8000-01-01T00:00:00.000Z"),
        to: new Date("8000-01-03T00:00:00.000Z"),
      }
    );
    const elapsedMilliseconds = performance.now() - startedAt;

    expect(occurrences.map((occurrence) => occurrence.localOccurrence)).toEqual([
      "8000-01-01T09:30",
      "8000-01-02T09:30",
    ]);
    expect(elapsedMilliseconds).toBeLessThan(1_000);
  });
});
