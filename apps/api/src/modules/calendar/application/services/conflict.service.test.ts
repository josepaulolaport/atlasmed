import { describe, expect, it } from "bun:test";
import {
  findCalendarConflicts,
  type CalendarConflictEntry,
} from "./conflict.service";
import type { CalendarRecurrenceRule } from "./recurrence.service";

function oneOff(
  id: string,
  localDate: string,
  localTime: string,
  durationMinutes = 60,
  overrides: Partial<CalendarConflictEntry> = {}
): CalendarConflictEntry {
  return {
    id,
    rule: {
      anchorLocalDate: localDate,
      anchorLocalTime: localTime,
      timeZone: "UTC",
      durationMinutes,
      recurrence: "NONE",
    },
    ...overrides,
  };
}

function recurring(
  id: string,
  ruleOverrides: Partial<CalendarRecurrenceRule>
): CalendarConflictEntry {
  return {
    id,
    rule: {
      anchorLocalDate: "2026-01-05",
      anchorLocalTime: "09:00",
      timeZone: "UTC",
      durationMinutes: 60,
      recurrence: "WEEKLY",
      ...ruleOverrides,
    },
  };
}

const january = {
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-02-01T00:00:00.000Z"),
};

describe("findCalendarConflicts", () => {
  it("returns concrete one-off occurrence pairs when intervals overlap", () => {
    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-15", "09:30"),
      [oneOff("existing", "2026-01-15", "10:00")],
      january
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      candidateId: "candidate",
      existingId: "existing",
      candidateOccurrenceKey: "2026-01-15T09:30[UTC]",
      existingOccurrenceKey: "2026-01-15T10:00[UTC]",
    });
  });

  it("does not report adjacent semi-open intervals", () => {
    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-15", "09:00"),
      [oneOff("existing", "2026-01-15", "10:00")],
      january
    );

    expect(conflicts).toEqual([]);
  });

  it("finds conflicts between one-off and recurring entries", () => {
    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-12", "09:30", 15),
      [recurring("existing", {})],
      january
    );

    expect(conflicts.map((conflict) => conflict.existingOccurrenceKey)).toEqual([
      "2026-01-12T09:00[UTC]",
    ]);
  });

  it("finds concrete recurring-to-recurring conflicts", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", { anchorLocalTime: "09:30", durationMinutes: 30 }),
      [recurring("existing", {})],
      january
    );

    expect(conflicts).toHaveLength(4);
    expect(conflicts[0]).toMatchObject({
      candidateOccurrenceKey: "2026-01-05T09:30[UTC]",
      existingOccurrenceKey: "2026-01-05T09:00[UTC]",
    });
  });

  it("returns every concrete pair when long recurrences overlap neighboring slots", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        anchorLocalTime: "09:00",
        durationMinutes: 2 * 24 * 60,
        recurrence: "DAILY",
        recurrenceCount: 3,
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          anchorLocalTime: "10:00",
          durationMinutes: 2 * 24 * 60,
          recurrence: "DAILY",
          recurrenceCount: 3,
        }),
      ],
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-05T00:00:00.000Z"),
      }
    );

    expect(conflicts).toContainEqual(
      expect.objectContaining({
        candidateOccurrenceKey: "2026-01-01T09:00[UTC]",
        existingOccurrenceKey: "2026-01-02T10:00[UTC]",
      })
    );
  });

  it("ignores cancelled existing occurrence keys and overrides", () => {
    const existing = recurring("existing", {});
    existing.cancelledOccurrenceKeys = ["2026-01-12T09:00[UTC]"];
    existing.overrides = {
      "2026-01-19T09:00[UTC]": { status: "CANCELLED" },
    };

    const conflicts = findCalendarConflicts(
      recurring("candidate", { anchorLocalTime: "09:30", durationMinutes: 15 }),
      [existing],
      january
    );

    expect(conflicts.map((conflict) => conflict.existingOccurrenceKey)).toEqual([
      "2026-01-05T09:00[UTC]",
      "2026-01-26T09:00[UTC]",
    ]);
  });

  it("applies non-cancelled existing occurrence overrides", () => {
    const existing = oneOff("existing", "2026-01-15", "09:00");
    existing.overrides = {
      "2026-01-15T09:00[UTC]": {
        startsAt: new Date("2026-01-15T11:00:00.000Z"),
        endsAt: new Date("2026-01-15T12:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-15", "11:30", 15),
      [existing],
      january
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.existingStartsAt).toEqual(
      new Date("2026-01-15T11:00:00.000Z")
    );
  });

  it("includes an active override moved into the query range", () => {
    const existing = oneOff("existing", "2026-02-02", "09:00");
    existing.overrides = {
      "2026-02-02T09:00[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-01-15T11:00:00.000Z"),
        endsAt: new Date("2026-01-15T12:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-15", "11:30", 15),
      [existing],
      january
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      existingOccurrenceKey: "2026-02-02T09:00[UTC]",
      existingStartsAt: new Date("2026-01-15T11:00:00.000Z"),
    });
  });

  it("excludes active overrides moved out of the query range", () => {
    const candidate = oneOff("candidate", "2026-01-15", "09:30", 15);
    candidate.overrides = {
      "2026-01-15T09:30[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-02-02T09:30:00.000Z"),
        endsAt: new Date("2026-02-02T09:45:00.000Z"),
      },
    };
    const existing = oneOff("existing", "2026-01-15", "09:00");
    existing.overrides = {
      "2026-01-15T09:00[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-02-02T09:00:00.000Z"),
        endsAt: new Date("2026-02-02T10:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(candidate, [existing], january);

    expect(conflicts).toEqual([]);
  });

  it("keeps overridden existing occurrences ordered for conflict scanning", () => {
    const existing = recurring("existing", {
      anchorLocalDate: "2026-01-01",
      recurrence: "DAILY",
      recurrenceCount: 2,
    });
    existing.overrides = {
      "2026-01-01T09:00[UTC]": {
        startsAt: new Date("2026-01-03T11:00:00.000Z"),
        endsAt: new Date("2026-01-03T12:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-01-02", "09:30", 15),
      [existing],
      january
    );

    expect(conflicts.map((conflict) => conflict.existingOccurrenceKey)).toEqual([
      "2026-01-02T09:00[UTC]",
    ]);
  });

  it("caps UI feedback at 100 deterministic conflict pairs", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        recurrence: "DAILY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          recurrence: "DAILY",
        }),
      ],
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2027-01-01T00:00:00.000Z"),
      }
    );

    expect(conflicts).toHaveLength(100);
    expect(conflicts[0]?.candidateOccurrenceKey).toBe(
      "2026-01-01T09:00[UTC]"
    );
    expect(conflicts[99]?.candidateOccurrenceKey).toBe(
      "2026-04-10T09:00[UTC]"
    );
  });

  it("streams unbounded identical daily rules and returns capped conflicts quickly", () => {
    const startedAt = performance.now();
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        recurrence: "DAILY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          recurrence: "DAILY",
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );
    const elapsedMilliseconds = performance.now() - startedAt;

    expect(conflicts).toHaveLength(100);
    expect(conflicts[99]?.candidateOccurrenceKey).toBe(
      "2026-04-10T09:00[UTC]"
    );
    expect(elapsedMilliseconds).toBeLessThan(1_000);
  });

  it("uses a bounded 400-year calendar cycle when the comparison range is unbounded", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2024-02-29",
        anchorLocalTime: "09:00",
        recurrence: "YEARLY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2025-02-28",
          anchorLocalTime: "09:30",
          recurrence: "YEARLY",
        }),
      ],
      { from: new Date("2024-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toHaveLength(100);
    expect(conflicts[0]).toMatchObject({
      candidateOccurrenceKey: "2025-02-28T09:00[UTC]",
      existingOccurrenceKey: "2025-02-28T09:30[UTC]",
    });
  });

  it("keeps each concrete pair when an unbounded long occurrence overlaps neighbors", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        anchorLocalTime: "09:00",
        durationMinutes: 2 * 24 * 60,
        recurrence: "DAILY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          anchorLocalTime: "10:00",
          durationMinutes: 60,
          recurrence: "DAILY",
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toContainEqual(
      expect.objectContaining({
        candidateOccurrenceKey: "2026-01-01T09:00[UTC]",
        existingOccurrenceKey: "2026-01-02T10:00[UTC]",
      })
    );
  });

  it("returns the globally earliest 100 conflicts regardless of existing input order", () => {
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        recurrence: "DAILY",
      }),
      [
        recurring("later", {
          anchorLocalDate: "2026-06-01",
          recurrence: "DAILY",
        }),
        recurring("earlier", {
          anchorLocalDate: "2026-01-01",
          recurrence: "DAILY",
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toHaveLength(100);
    expect(new Set(conflicts.map((conflict) => conflict.existingId))).toEqual(
      new Set(["earlier"])
    );
    expect(conflicts[99]?.candidateOccurrenceKey).toBe(
      "2026-04-10T09:00[UTC]"
    );
  });

  it("supports finite occurrence state on an otherwise unbounded series", () => {
    const existing = recurring("existing", {
      anchorLocalDate: "2026-01-01",
      recurrence: "DAILY",
    });
    existing.cancelledOccurrenceKeys = ["2026-01-01T09:00[UTC]"];
    existing.overrides = {
      "2026-01-02T09:00[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-01-02T11:00:00.000Z"),
        endsAt: new Date("2026-01-02T12:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        anchorLocalTime: "09:30",
        durationMinutes: 15,
        recurrence: "DAILY",
      }),
      [existing],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toHaveLength(100);
    expect(conflicts[0]?.existingOccurrenceKey).toBe("2026-01-03T09:00[UTC]");
  });

  it("considers a moved unbounded override beyond the other finite series end", () => {
    const candidate = recurring("candidate", {
      anchorLocalDate: "2026-01-01",
      recurrence: "DAILY",
    });
    candidate.overrides = {
      "2026-02-15T09:00[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-03-01T09:00:00.000Z"),
        endsAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      candidate,
      [
        oneOff("existing", "2026-01-01", "12:00", 15, {
          overrides: {
            "2026-01-01T12:00[UTC]": {
              status: "ACTIVE",
              startsAt: new Date("2026-03-01T09:30:00.000Z"),
              endsAt: new Date("2026-03-01T09:45:00.000Z"),
            },
          },
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toContainEqual(
      expect.objectContaining({
        candidateOccurrenceKey: "2026-02-15T09:00[UTC]",
        existingOccurrenceKey: "2026-01-01T12:00[UTC]",
      })
    );
  });

  it("includes an override moved after a finite series nominal end", () => {
    const existing = recurring("existing", {
      anchorLocalDate: "2026-01-01",
      recurrence: "DAILY",
      recurrenceCount: 2,
    });
    existing.overrides = {
      "2026-01-02T09:00[UTC]": {
        status: "ACTIVE",
        startsAt: new Date("2026-02-15T09:00:00.000Z"),
        endsAt: new Date("2026-02-15T10:00:00.000Z"),
      },
    };

    const conflicts = findCalendarConflicts(
      oneOff("candidate", "2026-02-15", "09:30", 15),
      [existing],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.existingOccurrenceKey).toBe("2026-01-02T09:00[UTC]");
  });

  it("proves separated unbounded daily rules have no UTC conflicts quickly", () => {
    const startedAt = performance.now();
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        anchorLocalTime: "09:00",
        durationMinutes: 30,
        recurrence: "DAILY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          anchorLocalTime: "10:00",
          durationMinutes: 30,
          recurrence: "DAILY",
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );
    const elapsedMilliseconds = performance.now() - startedAt;

    expect(conflicts).toEqual([]);
    expect(elapsedMilliseconds).toBeLessThan(1_000);
  });

  it("proves separated unbounded daily rules have no DST-zone conflicts quickly", () => {
    const startedAt = performance.now();
    const conflicts = findCalendarConflicts(
      recurring("candidate", {
        anchorLocalDate: "2026-01-01",
        anchorLocalTime: "09:00",
        timeZone: "America/New_York",
        durationMinutes: 30,
        recurrence: "DAILY",
      }),
      [
        recurring("existing", {
          anchorLocalDate: "2026-01-01",
          anchorLocalTime: "10:00",
          timeZone: "America/New_York",
          durationMinutes: 30,
          recurrence: "DAILY",
        }),
      ],
      { from: new Date("2026-01-01T00:00:00.000Z") }
    );
    const elapsedMilliseconds = performance.now() - startedAt;

    expect(conflicts).toEqual([]);
    expect(elapsedMilliseconds).toBeLessThan(2_000);
  });
});
