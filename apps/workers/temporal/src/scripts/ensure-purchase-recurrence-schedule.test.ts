import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError } from "@temporalio/client";
import {
  LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID,
  PURCHASE_RECURRENCE_SCHEDULES,
  ensurePurchaseRecurrenceSchedules,
} from "./ensure-purchase-recurrence-schedule";

describe("purchase recurrence schedule provisioning", () => {
  /**
   * Two schedules, two ids. The daily repair used to be a branch inside the
   * hourly run chosen by the hour of day, which `SKIP` could swallow whole: an
   * hourly run overrunning past midnight skipped the midnight firing and the
   * sweep with it, losing the only pass that catches deleted orders and
   * external writers that did not move `updated_at`.
   */
  test("separates the hourly reconcile from the daily sweep", () => {
    expect(PURCHASE_RECURRENCE_SCHEDULES).toEqual([
      expect.objectContaining({
        scheduleId: "facility-purchase-recurrence-hourly",
        workflowId: "facility-purchase-recurrence-hourly",
        calendar: { minute: 0, hour: "*" },
        fullSweep: false,
      }),
      expect.objectContaining({
        scheduleId: "facility-purchase-recurrence-daily-sweep",
        workflowId: "facility-purchase-recurrence-daily-sweep",
        fullSweep: true,
      }),
    ]);

    const ids = PURCHASE_RECURRENCE_SCHEDULES.map((schedule) => schedule.scheduleId);
    expect(new Set(ids).size).toBe(ids.length);
    // Distinct workflow ids too, or `SKIP` would couple them right back
    // together.
    const workflowIds = PURCHASE_RECURRENCE_SCHEDULES.map((schedule) => schedule.workflowId);
    expect(new Set(workflowIds).size).toBe(workflowIds.length);
  });

  test("runs the sweep in the Brazilian small hours, not during the working evening", () => {
    const sweep = PURCHASE_RECURRENCE_SCHEDULES[1];
    // 06:30 UTC is 03:30 in São Paulo. The old midnight-UTC slot was 21:00
    // there, which is the worst time to hold locks over every active facility.
    expect(sweep?.calendar).toEqual({ minute: 30, hour: 6 });
  });

  /**
   * Asserting the calendar literal is what let this ship: `{ minute: 0 }` reads
   * as "every hour on the hour" and matched the assertion happily, while
   * Temporal resolved the omitted `hour` to 0 and ran it once a day at
   * midnight. The bug lives in the field that *isn't* written, so the guard has
   * to name it.
   */
  test("pins the hour explicitly, since an omitted field resolves to 0 rather than every hour", () => {
    const [hourly] = PURCHASE_RECURRENCE_SCHEDULES;
    expect(hourly?.calendar.hour).toBe("*");
  });

  test("deletes the legacy schedule and updates the canonical schedule", async () => {
    const create = mock(async (_options: unknown) => {});
    const deleteLegacy = mock(async () => {});
    const updates: Array<(value: { state: object }) => { action: { args: unknown[] } }> = [];
    const update = async (updater: (value: { state: object }) => { action: { args: unknown[] } }) => { updates.push(updater); };
    const getHandle = mock((scheduleId: string) => scheduleId === LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID
      ? { delete: deleteLegacy }
      : { describe: mock(async () => ({ schedule: {} })), update });

    await ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, { taskQueue: "atlasmed" });

    expect(deleteLegacy).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
    expect(updates[0]?.({ state: {} }).action.args).toEqual([{ mode: "RECONCILE", fullSweep: false }]);
    expect(updates[1]?.({ state: {} }).action.args).toEqual([{ mode: "RECONCILE", fullSweep: true }]);
  });

  test("tolerates a missing legacy schedule and creates a missing canonical schedule", async () => {
    const create = mock(async (_options: unknown) => {});
    const getHandle = mock((scheduleId: string) => scheduleId === LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID
      ? { delete: mock(async () => { throw new ScheduleNotFoundError("missing", scheduleId); }) }
      : { describe: mock(async () => { throw new ScheduleNotFoundError("missing", scheduleId); }) });

    await ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, { taskQueue: "atlasmed" });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ scheduleId: "facility-purchase-recurrence-hourly" });
    expect(create.mock.calls[1]?.[0]).toMatchObject({ scheduleId: "facility-purchase-recurrence-daily-sweep" });
  });

  test("propagates non-not-found legacy deletion failures", async () => {
    const failure = new Error("temporal unavailable");
    const create = mock(async (_options: unknown) => {});
    const getHandle = mock((scheduleId: string) => scheduleId === LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID
      ? { delete: mock(async () => { throw failure; }) }
      : { describe: mock(async () => ({ schedule: {} })), update: mock(async () => {}) });

    await expect(ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, { taskQueue: "atlasmed" }))
      .rejects.toBe(failure);
    expect(create).not.toHaveBeenCalled();
  });
});
