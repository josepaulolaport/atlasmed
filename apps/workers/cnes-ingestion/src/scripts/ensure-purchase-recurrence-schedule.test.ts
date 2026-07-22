import { describe, expect, mock, test } from "bun:test";
import {
  PURCHASE_RECURRENCE_SCHEDULES,
  ensurePurchaseRecurrenceSchedules,
} from "./ensure-purchase-recurrence-schedule";

describe("purchase recurrence schedule provisioning", () => {
  test("defines stable hourly and nightly UTC schedules with SKIP overlap and deterministic workflow IDs", () => {
    expect(PURCHASE_RECURRENCE_SCHEDULES).toEqual([
      expect.objectContaining({
        scheduleId: "facility-purchase-recurrence-hourly",
        workflowId: "facility-purchase-recurrence-hourly",
        overlap: "SKIP",
        calendar: { minute: 0 },
        fullSweep: false,
      }),
      expect.objectContaining({
        scheduleId: "facility-purchase-recurrence-nightly-repair",
        workflowId: "facility-purchase-recurrence-nightly-repair",
        overlap: "SKIP",
        calendar: { hour: 0, minute: 0 },
        fullSweep: true,
      }),
    ]);
  });

  test("creates missing schedules and updates existing schedules idempotently", async () => {
    const create = mock(async () => {});
    const update = mock(async () => {});
    const getHandle = mock((id: string) => ({
      describe: id.includes("hourly")
        ? mock(async () => ({ schedule: {} }))
        : mock(async () => { throw Object.assign(new Error("missing"), { name: "ScheduleNotFoundError" }); }),
      update,
    }));

    await ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, {
      taskQueue: "atlasmed",
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
