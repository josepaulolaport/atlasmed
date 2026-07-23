import { describe, expect, mock, test } from "bun:test";
import { PURCHASE_RECURRENCE_SCHEDULES, ensurePurchaseRecurrenceSchedules } from "./ensure-purchase-recurrence-schedule";

describe("purchase recurrence schedule provisioning", () => {
  test("defines one stable hourly UTC schedule without a fixed fullSweep input", () => {
    expect(PURCHASE_RECURRENCE_SCHEDULES).toEqual([expect.objectContaining({ scheduleId: "facility-purchase-recurrence-hourly", workflowId: "facility-purchase-recurrence-hourly", overlap: "SKIP", calendar: { minute: 0 } })]);
    expect(PURCHASE_RECURRENCE_SCHEDULES[0]).not.toHaveProperty("fullSweep");
  });

  test("updates the single schedule idempotently", async () => {
    const create = mock(async () => {});
    const updates: Array<(value: { state: object }) => { action: { args: unknown[] } }> = [];
    const update = async (updater: (value: { state: object }) => { action: { args: unknown[] } }) => { updates.push(updater); };
    const getHandle = mock(() => ({ describe: mock(async () => ({ schedule: {} })), update }));
    await ensurePurchaseRecurrenceSchedules({ create, getHandle } as never, { taskQueue: "atlasmed" });
    expect(updates).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
    expect(updates[0]?.({ state: {} }).action.args).toEqual([{ mode: "RECONCILE" }]);
  });
});
