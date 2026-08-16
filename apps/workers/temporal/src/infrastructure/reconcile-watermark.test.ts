import { describe, expect, test } from "bun:test";
import { planReconcileWindow } from "./reconcile-watermark";

/**
 * The gap this closes, in both reconcilers: `since` was a fixed lookback from
 * each run's own start, so under overlap `SKIP` a run that overran left the
 * hours after it covered by nobody.
 */
describe("planReconcileWindow", () => {
  const until = "2026-07-22T00:00:00.000Z";

  test("falls back to the two-hour lookback before the first watermark", () => {
    expect(planReconcileWindow({ coveredUntil: null, until })).toEqual({
      since: "2026-07-21T22:00:00.000Z",
      fullSweep: false,
    });
  });

  test("reaches back to wherever the last completed run actually got to", () => {
    expect(planReconcileWindow({
      coveredUntil: "2026-07-21T18:00:00.000Z",
      until,
    })).toEqual({ since: "2026-07-21T18:00:00.000Z", fullSweep: false });
  });

  test("never narrows below the lookback, so a just-committed row is not missed", () => {
    expect(planReconcileWindow({
      coveredUntil: "2026-07-21T23:50:00.000Z",
      until,
    })).toEqual({ since: "2026-07-21T22:00:00.000Z", fullSweep: false });
  });

  test("asks for a sweep instead of widening the window past a day", () => {
    expect(planReconcileWindow({
      coveredUntil: "2026-07-19T00:00:00.000Z",
      until,
    })).toEqual({ since: "2026-07-19T00:00:00.000Z", fullSweep: true });
  });

  test("ignores a watermark from the future rather than inverting the window", () => {
    expect(planReconcileWindow({
      coveredUntil: "2026-07-23T00:00:00.000Z",
      until,
    })).toEqual({ since: "2026-07-21T22:00:00.000Z", fullSweep: false });
  });

  test("ignores an unparseable watermark", () => {
    expect(planReconcileWindow({ coveredUntil: "not a date", until })).toEqual({
      since: "2026-07-21T22:00:00.000Z",
      fullSweep: false,
    });
  });
});
