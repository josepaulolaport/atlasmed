import { describe, expect, mock, test } from "bun:test";
import {
  PURCHASE_RECURRENCE_ACTIVITY_OPTIONS,
  runPurchaseRecurrenceWorkflow,
} from "./purchase-recurrence.workflow";

describe("purchase recurrence workflow", () => {
  test("uses explicit retry policy and 500-row pages", async () => {
    expect(PURCHASE_RECURRENCE_ACTIVITY_OPTIONS).toEqual({
      startToCloseTimeout: "30 minutes",
      retry: {
        maximumAttempts: 5,
        initialInterval: "5 seconds",
        backoffCoefficient: 2,
        maximumInterval: "2 minutes",
      },
    });

    const recalculate = mock(async (_input: unknown) => ({
      processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [],
    }));
    await runPurchaseRecurrenceWorkflow(
      { mode: "RECONCILE", today: "2026-07-22", since: "2026-07-22T08:00:00.000Z", until: "2026-07-22T10:00:00.000Z" },
      { recalculate, rebuild: async () => {}, continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date("2026-07-22T10:00:00.000Z") },
    );

    expect(recalculate.mock.calls[0]?.[0]).toMatchObject({ limit: 500 });
  });

  test("continues as new after 10k rows while preserving aggregate counters", async () => {
    let cursor = 0;
    const continueAsNew = mock(async (_input: unknown) => undefined as never);
    await runPurchaseRecurrenceWorkflow(
      { mode: "BACKFILL", today: "2026-07-22" },
      {
        recalculate: async () => {
          cursor += 500;
          return { processed: 500, updated: 400, failed: 2, nextCursor: `f-${cursor}`, failures: [] };
        },
        rebuild: async () => {},
        continueAsNew,
        startedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    );

    expect(continueAsNew).toHaveBeenCalledTimes(1);
    expect(continueAsNew.mock.calls[0]?.[0]).toMatchObject({
      mode: "BACKFILL",
      cursor: "f-10000",
      totals: { processed: 10000, updated: 8000, failed: 40 },
      finalRebuildCompleted: false,
    });
  });

  test("runs the final facility rebuild exactly once at final BACKFILL completion", async () => {
    const rebuild = mock(async () => {});
    const result = await runPurchaseRecurrenceWorkflow(
      { mode: "BACKFILL", today: "2026-07-22", totals: { processed: 10000, updated: 8000, failed: 40 } },
      {
        recalculate: async () => ({ processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [] }),
        rebuild,
        continueAsNew: async () => { throw new Error("unexpected"); },
        startedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    );

    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(rebuild).toHaveBeenCalledWith({ target: "facilities" });
    expect(result).toMatchObject({ processed: 10000, updated: 8000, failed: 40, finalRebuildCompleted: true });
  });

  test("does not repeat the final rebuild after a continued run records completion", async () => {
    const rebuild = mock(async () => {});
    await runPurchaseRecurrenceWorkflow(
      { mode: "BACKFILL", today: "2026-07-22", finalRebuildCompleted: true },
      {
        recalculate: async () => ({ processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [] }),
        rebuild,
        continueAsNew: async () => { throw new Error("unexpected"); },
        startedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    );
    expect(rebuild).not.toHaveBeenCalled();
  });

  test("expresses nightly repair as a full reconcile sweep", async () => {
    const recalculate = mock(async (_input: unknown) => ({ processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [] }));
    await runPurchaseRecurrenceWorkflow(
      { mode: "RECONCILE", today: "2026-07-22", fullSweep: true },
      { recalculate, rebuild: async () => {}, continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date("2026-07-22T10:00:00.000Z") },
    );
    expect(recalculate.mock.calls[0]?.[0]).toMatchObject({ mode: "RECONCILE", fullSweep: true });
  });
});
