import { describe, expect, mock, test } from "bun:test";
import type { PurchaseRecurrenceLifecycleLogInput } from "../activities/purchase-recurrence.activities";
import {
  PURCHASE_RECURRENCE_ACTIVITY_OPTIONS,
  PURCHASE_RECURRENCE_FINAL_REBUILD_ACTIVITY_OPTIONS,
  runPurchaseRecurrenceWorkflow,
} from "./purchase-recurrence.workflow";

const emptyPage = { processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [] };

describe("purchase recurrence workflow", () => {
  test("uses explicit page retry policy and a separate two-hour final rebuild deadline", () => {
    expect(PURCHASE_RECURRENCE_ACTIVITY_OPTIONS).toEqual({ startToCloseTimeout: "30 minutes", retry: { maximumAttempts: 5, initialInterval: "5 seconds", backoffCoefficient: 2, maximumInterval: "2 minutes" } });
    expect(PURCHASE_RECURRENCE_FINAL_REBUILD_ACTIVITY_OPTIONS).toEqual({ startToCloseTimeout: "2 hours", retry: { maximumAttempts: 3, initialInterval: "30 seconds", backoffCoefficient: 2, maximumInterval: "10 minutes" } });
  });

  test("continues as new with the identical computed window, sweep decision, source cursor, and totals", async () => {
    let cursor = 0;
    const continuedInputs: unknown[] = [];
    const continueAsNew = async (input: unknown) => {
      continuedInputs.push(input);
      return undefined as never;
    };
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE", cursor: 100 }, {
      recalculate: async (input) => {
        expect(input.today).toBe("2026-07-22");
        expect(input.since).toBe("2026-07-21T22:00:00.000Z");
        expect(input.until).toBe("2026-07-22T00:00:00.000Z");
        expect(input.fullSweep).toBe(true);
        cursor += 500;
        return { processed: 500, updated: 400, failed: 0, nextCursor: cursor, failures: [] };
      },
      rebuild: async () => {},
      logLifecycle: async () => {},
      continueAsNew,
      startedAt: new Date("2026-07-22T00:00:00.000Z"),
      now: () => Date.parse("2026-07-22T00:01:00.000Z"),
    });
    expect(continuedInputs[0]).toMatchObject({
      mode: "RECONCILE", today: "2026-07-22", since: "2026-07-21T22:00:00.000Z", until: "2026-07-22T00:00:00.000Z", fullSweep: true,
      cursor: 10000, sourceCursor: 100, totals: { processed: 10000, updated: 8000, failed: 0 }, lifecycleStartedAt: "2026-07-22T00:00:00.000Z",
    });
  });

  test("derives full sweep only for the single hourly execution at UTC midnight", async () => {
    for (const [startedAt, expected] of [["2026-07-22T00:00:00.000Z", true], ["2026-07-22T01:00:00.000Z", false]] as const) {
      const recalculatedInputs: unknown[] = [];
      const recalculate = async (input: unknown) => {
        recalculatedInputs.push(input);
        return emptyPage;
      };
      await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
        recalculate, rebuild: async () => {}, logLifecycle: async () => {}, continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date(startedAt), now: () => Date.parse(startedAt),
      });
      expect(recalculatedInputs[0]).toMatchObject({ fullSweep: expected });
    }
  });

  test("logs stable lifecycle actions with aggregate counters and duration", async () => {
    const lifecycleLogs: PurchaseRecurrenceLifecycleLogInput[] = [];
    const logLifecycle = async (input: PurchaseRecurrenceLifecycleLogInput) => { lifecycleLogs.push(input); };
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      recalculate: async () => ({ processed: 3, updated: 2, failed: 0, nextCursor: null, failures: [] }), rebuild: async () => {}, logLifecycle,
      continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date("2026-07-22T10:00:00.000Z"), now: () => Date.parse("2026-07-22T10:00:05.000Z"),
    });
    expect(lifecycleLogs).toEqual([
      { action: "facility_purchase_recurrence.reconcile_started", mode: "RECONCILE", today: "2026-07-22", fullSweep: false, processed: 0, updated: 0, failed: 0, durationMs: 0 },
      { action: "facility_purchase_recurrence.reconcile_completed", mode: "RECONCILE", today: "2026-07-22", fullSweep: false, processed: 3, updated: 2, failed: 0, durationMs: 5000 },
    ]);
  });

  test("runs the final facility rebuild once after BACKFILL completion", async () => {
    const rebuild = mock(async () => {});
    const result = await runPurchaseRecurrenceWorkflow({ mode: "BACKFILL", today: "2026-07-22", totals: { processed: 10000, updated: 8000, failed: 0 } }, {
      recalculate: async () => emptyPage, rebuild, logLifecycle: async () => {}, continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date("2026-07-22T10:00:00.000Z"), now: () => Date.parse("2026-07-22T10:00:01.000Z"),
    });
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(rebuild).toHaveBeenCalledWith({ target: "facilities" });
    expect(result.finalRebuildCompleted).toBe(true);
  });
});
