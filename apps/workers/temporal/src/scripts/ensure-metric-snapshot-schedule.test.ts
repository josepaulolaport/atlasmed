import { describe, expect, test } from "bun:test";
import { METRIC_SNAPSHOT_SCHEDULES } from "./ensure-metric-snapshot-schedule";

/**
 * Temporal resolves an omitted calendar field to 0, not to every value, so
 * `{ minute: 0 }` is midnight daily rather than hourly. Both "hourly" schedules
 * in this worker shipped that way and ran once a day until 2026-08-14 — the
 * metric snapshot landing at 00:00, on top of the nightly pass that 03:00 was
 * picked to avoid.
 */
describe("metric snapshot schedule provisioning", () => {
  test("runs the reconcile pass every hour, with the hour named explicitly", () => {
    const hourly = METRIC_SNAPSHOT_SCHEDULES.find(
      (schedule) => schedule.scheduleId === "facility-metric-snapshot-hourly"
    );
    expect(hourly?.calendar).toEqual({ minute: 0, hour: "*" });
    expect(hourly?.mode).toBe("RECONCILE");
  });

  test("keeps the nightly pass at 03:00, clear of the hourly run", () => {
    const nightly = METRIC_SNAPSHOT_SCHEDULES.find(
      (schedule) => schedule.scheduleId === "facility-metric-snapshot-nightly"
    );
    expect(nightly?.calendar).toEqual({ hour: 3, minute: 0 });
    expect(nightly?.mode).toBe("NIGHTLY");
  });
});
