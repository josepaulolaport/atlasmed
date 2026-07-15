import { describe, expect, test } from "bun:test";
import { getMondayToMondayWeek } from "./week-boundary.service";

describe("getMondayToMondayWeek", () => {
  test("uses America/Sao_Paulo Monday midnight boundaries for a Sunday", () => {
    const week = getMondayToMondayWeek(new Date("2026-03-08T15:00:00.000Z"), "America/Sao_Paulo");

    expect(week.start.toISOString()).toBe("2026-03-02T03:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-03-09T03:00:00.000Z");
  });

  test("moves to the new week at Monday midnight in the configured timezone", () => {
    const before = getMondayToMondayWeek(new Date("2026-03-09T02:59:59.999Z"), "America/Sao_Paulo");
    const atBoundary = getMondayToMondayWeek(new Date("2026-03-09T03:00:00.000Z"), "America/Sao_Paulo");

    expect(before.start.toISOString()).toBe("2026-03-02T03:00:00.000Z");
    expect(atBoundary.start.toISOString()).toBe("2026-03-09T03:00:00.000Z");
  });

  test("respects the supplied timezone rather than the server timezone", () => {
    const week = getMondayToMondayWeek(new Date("2026-03-09T00:30:00.000Z"), "America/Sao_Paulo");

    expect(week.start.toISOString()).toBe("2026-03-02T03:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-03-09T03:00:00.000Z");
  });
});
