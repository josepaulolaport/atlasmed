import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError } from "@temporalio/client";
import {
  LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID,
  PURCHASE_RECURRENCE_SCHEDULES,
  ensurePurchaseRecurrenceSchedules,
} from "./ensure-purchase-recurrence-schedule";

describe("purchase recurrence schedule provisioning", () => {
  test("defines one stable hourly UTC schedule without a fixed fullSweep input", () => {
    expect(PURCHASE_RECURRENCE_SCHEDULES).toEqual([expect.objectContaining({ scheduleId: "facility-purchase-recurrence-hourly", workflowId: "facility-purchase-recurrence-hourly", overlap: "SKIP", calendar: { minute: 0, hour: "*" } })]);
    expect(PURCHASE_RECURRENCE_SCHEDULES[0]).not.toHaveProperty("fullSweep");
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
    expect(updates).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
    expect(updates[0]?.({ state: {} }).action.args).toEqual([{ mode: "RECONCILE" }]);
  });

  test("tolerates a missing legacy schedule and creates a missing canonical schedule", async () => {
    const create = mock(async (_options: unknown) => {});
    const getHandle = mock((scheduleId: string) => scheduleId === LEGACY_PURCHASE_RECURRENCE_SCHEDULE_ID
      ? { delete: mock(async () => { throw new ScheduleNotFoundError("missing", scheduleId); }) }
      : { describe: mock(async () => { throw new ScheduleNotFoundError("missing", scheduleId); }) });

    await ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, { taskQueue: "atlasmed" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ scheduleId: "facility-purchase-recurrence-hourly" });
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
