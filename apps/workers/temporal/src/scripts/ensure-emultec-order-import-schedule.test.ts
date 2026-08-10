import { describe, expect, mock, test } from "bun:test";
import { ScheduleNotFoundError } from "@temporalio/client";
import {
  EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS,
  EMULTEC_ORDER_IMPORT_SCHEDULES,
  LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID,
  ensureEmultecOrderImportSchedules,
} from "./ensure-emultec-order-import-schedule";

describe("emultec order import schedule provisioning", () => {
  test("defines a 10m HYBRID schedule that never overlaps", () => {
    expect(EMULTEC_ORDER_IMPORT_SCHEDULES).toEqual([
      expect.objectContaining({
        scheduleId: "emultec-order-import-every-10m",
        workflowId: "emultec-order-import-every-10m",
      }),
    ]);
    // Emultec is a third-party production database, so these values are the
    // contract with it, not incidental config: a timer must never launch an
    // unbounded BACKFILL, and every run is capped.
    expect(EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS).toEqual({
      mode: "HYBRID",
      pageSize: 200,
      maxPages: 50,
      triggerPurchaseRecurrence: true,
    });
  });

  test("updates existing schedule and deletes legacy daily id", async () => {
    const create = mock(async (_options: unknown) => {});
    const deleteLegacy = mock(async () => {});
    const updates: Array<
      (value: { state: object }) => {
        action: { args: unknown[] };
        policies: { overlap: string };
        spec: { intervals: unknown[] };
      }
    > = [];
    const update = async (
      updater: (value: { state: object }) => {
        action: { args: unknown[] };
        policies: { overlap: string };
        spec: { intervals: unknown[] };
      }
    ) => {
      updates.push(updater);
    };
    const getHandle = mock((scheduleId: string) =>
      scheduleId === LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID
        ? { delete: deleteLegacy }
        : { describe: mock(async () => ({ schedule: {} })), update }
    );

    await ensureEmultecOrderImportSchedules({ create, getHandle } as never, {
      taskQueue: "atlasmed",
    });

    expect(create).not.toHaveBeenCalled();
    expect(deleteLegacy).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
    const next = updates[0]?.({ state: {} });
    expect(next?.action.args).toEqual([EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS]);
    expect(next?.spec.intervals).toEqual([{ every: "10m" }]);
    // Only one import may touch Emultec at a time, and a tick arriving during a
    // run is dropped rather than queued behind it — BUFFER_ONE is what turned
    // one stuck run into a dead schedule on 2026-08-09.
    expect(next?.policies.overlap).toBe("SKIP");
  });

  test("creates when schedule is missing; tolerates missing legacy", async () => {
    const create = mock(async (_options: unknown) => {});
    const getHandle = mock((scheduleId: string) =>
      scheduleId === LEGACY_EMULTEC_ORDER_IMPORT_SCHEDULE_ID
        ? {
            delete: mock(async () => {
              throw new ScheduleNotFoundError("missing", scheduleId);
            }),
          }
        : {
            describe: mock(async () => {
              throw new ScheduleNotFoundError("missing", scheduleId);
            }),
          }
    );

    await ensureEmultecOrderImportSchedules({ create, getHandle } as never, {
      taskQueue: "atlasmed",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      scheduleId: "emultec-order-import-every-10m",
      action: {
        workflowType: "emultecOrderImportWorkflow",
        args: [EMULTEC_ORDER_IMPORT_SCHEDULE_ARGS],
      },
      policies: {
        overlap: "SKIP",
        catchupWindow: "1m",
      },
    });
  });
});
