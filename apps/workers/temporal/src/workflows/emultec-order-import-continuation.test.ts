import { describe, expect, test } from "bun:test";
import {
  MAX_BACKFILL_LEGS,
  planBackfillContinuation,
} from "./emultec-order-import.workflow";

/**
 * A BACKFILL used to restart at `afterId = 0` on every trigger. With the
 * shipped defaults (`DEFAULT_MAX_PAGES` 50 x pageSize 100) that covered 5 000
 * of ~18 500 candidate orders, reported success, and re-covered the same rows
 * forever — the failure was invisible precisely because the run looked healthy.
 *
 * These assertions cover both halves: when to hand over, and what the next leg
 * inherits. A total dropped from the payload silently resets to zero and the
 * digest under-reports for the rest of the backfill.
 */
const totals = {
  pages: 50,
  fetched: 10_000,
  upserted: 4_000,
  changed: 3_500,
  skipped: 6_000,
  linkFailures: 2,
  skipReasons: { seller_unmapped: 5_000, facility_no_match: 1_000 },
  facilityIds: [11, 22],
};

function plan(overrides: Parameters<typeof planBackfillContinuation>[0]) {
  return planBackfillContinuation(overrides);
}

const base = {
  mode: "BACKFILL" as const,
  phase: { hitPageCap: true, lastId: 10_000 },
  afterId: 0,
  maxPagesPinned: false,
  leg: 0,
  runId: 77,
  startedAtIso: "2026-08-14T03:00:00.000Z",
  totals,
};

describe("planBackfillContinuation", () => {
  test("continues when a BACKFILL fills its page budget", () => {
    const result = plan(base);
    expect(result.kind).toBe("continue");
  });

  test("the next leg inherits the cursor, the run row, and every total", () => {
    const result = plan(base);
    if (result.kind !== "continue") throw new Error("expected continue");

    expect(result.resume).toEqual({
      // Same digest row: one run per logical backfill, not one per leg.
      runId: 77,
      // Original start, so the recurrence window still covers earlier legs.
      startedAtIso: "2026-08-14T03:00:00.000Z",
      afterId: 10_000,
      leg: 1,
      pages: 50,
      fetched: 10_000,
      upserted: 4_000,
      changed: 3_500,
      skipped: 6_000,
      linkFailures: 2,
      skipReasons: { seller_unmapped: 5_000, facility_no_match: 1_000 },
      facilityIds: [11, 22],
    });
  });

  test("stops when Emultec ran out of rows rather than budget", () => {
    expect(plan({ ...base, phase: { hitPageCap: false, lastId: 10_000 } }).kind).toBe(
      "stop"
    );
  });

  test.each(["HYBRID", "INCREMENTAL", "RECONCILE", "SKIP_RECHECK"] as const)(
    "%s never continues",
    (mode) => {
      // HYBRID runs on a 10-minute timer where the page cap is the only thing
      // bounding reads against a third-party database.
      expect(plan({ ...base, mode }).kind).toBe("stop");
    }
  );

  test("stops when the cursor did not move", () => {
    // Continuing here would re-read the same page forever.
    expect(plan({ ...base, afterId: 10_000 }).kind).toBe("stop");
    expect(plan({ ...base, afterId: 10_001 }).kind).toBe("stop");
  });

  test("an explicitly pinned maxPages is a bound, not a per-leg budget", () => {
    // `maxPages: 5` must mean five pages. Continuing would honour the letter of
    // the cap while walking the whole history anyway.
    expect(plan({ ...base, maxPagesPinned: true }).kind).toBe("stop");
  });

  test("stops when there is no cursor at all", () => {
    expect(plan({ ...base, phase: { hitPageCap: true, lastId: null } }).kind).toBe(
      "stop"
    );
  });

  test("refuses to continue past the leg cap", () => {
    const result = plan({ ...base, leg: MAX_BACKFILL_LEGS - 1 });
    expect(result.kind).toBe("leg_cap");
    if (result.kind !== "leg_cap") throw new Error("expected leg_cap");
    expect(result.leg).toBe(MAX_BACKFILL_LEGS);
    expect(result.afterId).toBe(10_000);
  });

  test("the leg counter advances by exactly one each time", () => {
    const result = plan({ ...base, leg: 3 });
    if (result.kind !== "continue") throw new Error("expected continue");
    expect(result.resume.leg).toBe(4);
  });
});
