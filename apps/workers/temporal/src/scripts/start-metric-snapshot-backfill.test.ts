import { describe, expect, test } from "bun:test";
import {
  buildBackfillInput,
  expandMonths,
  metricSnapshotBackfillWorkflowId,
  parseBackfillRange,
} from "./start-metric-snapshot-backfill";

/**
 * Argument handling only — no Temporal, no database.
 *
 * The behaviour worth protecting is the refusal: a backfill with no range, or
 * with a range that is not a month, must not run at all rather than run over
 * something the operator did not ask for.
 */
describe("parseBackfillRange", () => {
  test("refuses to run without an explicit range", () => {
    expect(() => parseBackfillRange([])).toThrow(/--from is required/);
    expect(() => parseBackfillRange(["--from=2026-01-01"])).toThrow(/--to is required/);
    expect(() => parseBackfillRange(["--to=2026-01-01"])).toThrow(/--from is required/);
  });

  test("refuses a month that is not the first of the month", () => {
    expect(() => parseBackfillRange(["--from=2026-01-15", "--to=2026-03-01"])).toThrow(
      /first day of a month/,
    );
    expect(() => parseBackfillRange(["--from=2026-01", "--to=2026-03-01"])).toThrow(
      /first day of a month/,
    );
    expect(() => parseBackfillRange(["--from=2026-01-01", "--to=marco"])).toThrow(
      /first day of a month/,
    );
  });

  test("refuses an impossible month", () => {
    expect(() => parseBackfillRange(["--from=2026-13-01", "--to=2026-13-01"])).toThrow(
      /impossible month/,
    );
    expect(() => parseBackfillRange(["--from=2026-00-01", "--to=2026-03-01"])).toThrow(
      /impossible month/,
    );
  });

  test("refuses a reversed range instead of silently backfilling nothing", () => {
    expect(() => parseBackfillRange(["--from=2026-03-01", "--to=2026-01-01"])).toThrow(
      /must not be after/,
    );
  });

  test("accepts a single-month range", () => {
    expect(parseBackfillRange(["--from=2026-02-01", "--to=2026-02-01"])).toEqual({
      from: "2026-02-01",
      to: "2026-02-01",
    });
  });

  test("ignores unrelated arguments", () => {
    expect(parseBackfillRange(["--dry-run", "--from=2026-02-01", "--to=2026-03-01"])).toEqual({
      from: "2026-02-01",
      to: "2026-03-01",
    });
  });
});

describe("expandMonths", () => {
  test("is inclusive on both ends", () => {
    expect(expandMonths({ from: "2026-01-01", to: "2026-03-01" })).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  test("a single-month range expands to that one month", () => {
    expect(expandMonths({ from: "2026-02-01", to: "2026-02-01" })).toEqual(["2026-02-01"]);
  });

  test("crosses a year boundary", () => {
    expect(expandMonths({ from: "2025-11-01", to: "2026-02-01" })).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  test("expands a long range without gaps or repeats", () => {
    const months = expandMonths({ from: "2024-01-01", to: "2026-12-01" });
    expect(months).toHaveLength(36);
    expect(new Set(months).size).toBe(36);
    expect(months[0]).toBe("2024-01-01");
    expect(months[35]).toBe("2026-12-01");
  });
});

describe("buildBackfillInput", () => {
  test("starts the sweep in BACKFILL mode over the expanded months", () => {
    const built = buildBackfillInput(["--from=2026-01-01", "--to=2026-03-01"]);
    expect(built.input).toEqual({
      mode: "BACKFILL",
      months: ["2026-01-01", "2026-02-01", "2026-03-01"],
    });
  });

  test("the workflow id names the range, so re-running the same range collapses", () => {
    const range = { from: "2026-01-01", to: "2026-03-01" };
    expect(metricSnapshotBackfillWorkflowId(range)).toBe(
      "metric-snapshot-backfill-2026-01-01-2026-03-01",
    );
    expect(buildBackfillInput(["--from=2026-01-01", "--to=2026-03-01"]).workflowId).toBe(
      metricSnapshotBackfillWorkflowId(range),
    );
  });
});
