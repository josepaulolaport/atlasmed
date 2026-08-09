import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError } from "@temporalio/client";
import {
  EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS,
  EMULTEC_ORDER_IMPORT_SCHEDULES,
  ensureEmultecOrderImportSchedules,
} from "./ensure-emultec-order-import-schedule";

describe("emultec order import schedule provisioning", () => {
  test("defines one daily HYBRID schedule", () => {
    expect(EMULTEC_ORDER_IMPORT_SCHEDULES).toEqual([
      expect.objectContaining({
        scheduleId: "emultec-order-import-daily",
        workflowId: "emultec-order-import-daily",
        calendar: { hour: 6, minute: 0 },
      }),
    ]);
    expect(EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS).toEqual({
      mode: "HYBRID",
      reconcileDays: 30,
      pageSize: 200,
      triggerPurchaseRecurrence: true,
    });
  });

  test("updates an existing schedule", async () => {
    const create = mock(async (_options: unknown) => {});
    const updates: Array<
      (value: { state: object }) => { action: { args: unknown[] } }
    > = [];
    const update = async (
      updater: (value: { state: object }) => { action: { args: unknown[] } }
    ) => {
      updates.push(updater);
    };
    const getHandle = mock(() => ({
      describe: mock(async () => ({ schedule: {} })),
      update,
    }));

    await ensureEmultecOrderImportSchedules({ create, getHandle } as never, {
      taskQueue: "atlasmed",
    });

    expect(create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0]?.({ state: {} }).action.args).toEqual([
      EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS,
    ]);
  });

  test("creates when schedule is missing", async () => {
    const create = mock(async (_options: unknown) => {});
    const getHandle = mock((scheduleId: string) => ({
      describe: mock(async () => {
        throw new ScheduleNotFoundError("missing", scheduleId);
      }),
    }));

    await ensureEmultecOrderImportSchedules({ create, getHandle } as never, {
      taskQueue: "atlasmed",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      scheduleId: "emultec-order-import-daily",
      action: {
        workflowType: "emultecOrderImportWorkflow",
        args: [EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS],
      },
    });
  });
});
