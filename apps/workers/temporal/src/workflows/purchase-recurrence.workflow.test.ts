import { describe, expect, mock, test } from "bun:test";
import type { PurchaseRecurrenceLifecycleLogInput } from "../activities/purchase-recurrence.activities";
import {
  PURCHASE_RECURRENCE_ACTIVITY_OPTIONS,
  PURCHASE_RECURRENCE_FINAL_REBUILD_ACTIVITY_OPTIONS,
  runPurchaseRecurrenceWorkflow,
} from "./purchase-recurrence.workflow";

const emptyPage = { processed: 0, updated: 0, failed: 0, nextCursor: null, failures: [] };

/** No watermark yet, so the window falls back to the two-hour lookback. */
const freshWindow = {
  claimWindow: async ({ until }: { until: string }) => ({
    since: new Date(Date.parse(until) - 2 * 60 * 60 * 1_000).toISOString(),
    fullSweep: false,
  }),
  commitWindow: async () => {},
};

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
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE", cursor: 100, fullSweep: true }, {
      ...freshWindow,
      recalculate: async (input) => {
        expect(input.today).toBe("2026-07-21");
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
      // Midnight UTC is still 21:00 on the 21st in São Paulo, and a stage
      // boundary is a Brazilian civil day.
      mode: "RECONCILE", today: "2026-07-21", since: "2026-07-21T22:00:00.000Z", until: "2026-07-22T00:00:00.000Z", fullSweep: true,
      cursor: 10000, sourceCursor: 100, totals: { processed: 10000, updated: 8000, failed: 0 }, lifecycleStartedAt: "2026-07-22T00:00:00.000Z",
    });
  });

  /**
   * The sweep used to be chosen by the hour of day on the shared hourly
   * schedule, which coupled it to `SKIP`: an hourly run overrunning past
   * midnight skipped the midnight firing and the daily repair with it. It is its
   * own schedule now, so only the caller asks for it.
   */
  test("sweeps only when the caller asks, whatever the hour", async () => {
    for (const startedAt of ["2026-07-22T00:00:00.000Z", "2026-07-22T01:00:00.000Z"]) {
      const recalculatedInputs: unknown[] = [];
      await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
        ...freshWindow,
        recalculate: async (input) => { recalculatedInputs.push(input); return emptyPage; },
        rebuild: async () => {}, logLifecycle: async () => {},
        continueAsNew: async () => { throw new Error("unexpected"); },
        startedAt: new Date(startedAt), now: () => Date.parse(startedAt),
      });
      expect(recalculatedInputs[0]).toMatchObject({ fullSweep: false });
    }

    const swept: unknown[] = [];
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE", fullSweep: true }, {
      ...freshWindow,
      recalculate: async (input) => { swept.push(input); return emptyPage; },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T06:30:00.000Z"), now: () => Date.parse("2026-07-22T06:30:00.000Z"),
    });
    expect(swept[0]).toMatchObject({ fullSweep: true });
  });

  /**
   * The gap this closes: with a fixed lookback, an overrunning run under `SKIP`
   * left the hours between two runs covered by nobody.
   */
  test("takes the window from the watermark, not from a fixed lookback", async () => {
    const recalculatedInputs: unknown[] = [];
    const commits: string[] = [];
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      // A previous run overran; this is where it actually got to.
      claimWindow: async () => ({ since: "2026-07-21T18:00:00.000Z", fullSweep: false }),
      commitWindow: async ({ until }) => { commits.push(until); },
      recalculate: async (input) => { recalculatedInputs.push(input); return emptyPage; },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T00:00:00.000Z"), now: () => Date.parse("2026-07-22T00:00:00.000Z"),
    });
    expect(recalculatedInputs[0]).toMatchObject({
      since: "2026-07-21T18:00:00.000Z",
      until: "2026-07-22T00:00:00.000Z",
    });
    expect(commits).toEqual(["2026-07-22T00:00:00.000Z"]);
  });

  /**
   * The hourly schedule passes `fullSweep: false` explicitly, so a `??` chain
   * here never reaches the plan and the 24-hour escalation could not fire at
   * all — the one case where the incremental window is least trustworthy.
   */
  test("escalates to a sweep even though the schedule passes fullSweep: false", async () => {
    const recalculatedInputs: unknown[] = [];
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE", fullSweep: false }, {
      claimWindow: async () => ({ since: "2026-07-01T00:00:00.000Z", fullSweep: true }),
      commitWindow: async () => {},
      recalculate: async (input) => { recalculatedInputs.push(input); return emptyPage; },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T00:00:00.000Z"), now: () => Date.parse("2026-07-22T00:00:00.000Z"),
    });
    expect(recalculatedInputs[0]).toMatchObject({ fullSweep: true });
  });

  test("honours a sweep the watermark plan asks for when it has fallen far behind", async () => {
    const recalculatedInputs: unknown[] = [];
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      claimWindow: async () => ({ since: "2026-07-01T00:00:00.000Z", fullSweep: true }),
      commitWindow: async () => {},
      recalculate: async (input) => { recalculatedInputs.push(input); return emptyPage; },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T00:00:00.000Z"), now: () => Date.parse("2026-07-22T00:00:00.000Z"),
    });
    expect(recalculatedInputs[0]).toMatchObject({ fullSweep: true });
  });

  test("does not advance the watermark when a page fails", async () => {
    const commitWindow = mock(async () => {});
    await expect(runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      ...freshWindow,
      commitWindow,
      recalculate: async () => { throw new Error("database unavailable"); },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T00:00:00.000Z"), now: () => Date.parse("2026-07-22T00:00:00.000Z"),
    })).rejects.toThrow("database unavailable");
    expect(commitWindow).not.toHaveBeenCalled();
  });

  /**
   * The child the Emultec import starts arrives with its own `since`/`until`,
   * and its `until` is six hours in the *future*. Committing that would park the
   * shared watermark ahead of anything covered, and every hourly run for those
   * six hours would fall back to the fixed lookback the watermark replaced.
   */
  test("a caller-supplied window neither claims nor advances the watermark", async () => {
    const claimWindow = mock(async () => ({ since: "unused", fullSweep: false }));
    const commitWindow = mock(async () => {});
    await runPurchaseRecurrenceWorkflow({
      mode: "RECONCILE",
      since: "2026-07-22T01:55:00.000Z",
      until: "2026-07-22T08:00:00.000Z",
    }, {
      claimWindow,
      commitWindow,
      recalculate: async () => emptyPage,
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T02:00:00.000Z"), now: () => Date.parse("2026-07-22T02:00:00.000Z"),
    });
    expect(claimWindow).not.toHaveBeenCalled();
    expect(commitWindow).not.toHaveBeenCalled();
  });

  test("a continued run still commits the window its first run claimed", async () => {
    const claimWindow = mock(async () => ({ since: "unused", fullSweep: false }));
    const commits: string[] = [];
    await runPurchaseRecurrenceWorkflow({
      mode: "RECONCILE",
      since: "2026-07-21T22:00:00.000Z",
      until: "2026-07-22T00:00:00.000Z",
      // What the first run threaded through `continueAsNew`.
      ownsWatermark: true,
    }, {
      claimWindow,
      commitWindow: async ({ until }) => { commits.push(until); },
      recalculate: async () => emptyPage,
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T02:00:00.000Z"), now: () => Date.parse("2026-07-22T02:00:00.000Z"),
    });
    expect(claimWindow).not.toHaveBeenCalled();
    expect(commits).toEqual(["2026-07-22T00:00:00.000Z"]);
  });

  test("carries watermark ownership across continue-as-new", async () => {
    const continued: unknown[] = [];
    let cursor = 0;
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      ...freshWindow,
      recalculate: async () => {
        cursor += 500;
        return { processed: 500, updated: 0, failed: 0, nextCursor: cursor, failures: [] };
      },
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async (next) => {
        continued.push(next);
        return undefined as never;
      },
      startedAt: new Date("2026-07-22T00:00:00.000Z"), now: () => Date.parse("2026-07-22T00:00:00.000Z"),
    });
    expect(continued[0]).toMatchObject({ ownsWatermark: true });
  });

  test("re-uses an already resolved window instead of re-claiming after continue-as-new", async () => {
    const claimWindow = mock(async () => ({ since: "unused", fullSweep: false }));
    await runPurchaseRecurrenceWorkflow({
      mode: "RECONCILE",
      since: "2026-07-21T22:00:00.000Z",
      until: "2026-07-22T00:00:00.000Z",
      today: "2026-07-21",
    }, {
      claimWindow,
      commitWindow: async () => {},
      recalculate: async () => emptyPage,
      rebuild: async () => {}, logLifecycle: async () => {},
      continueAsNew: async () => { throw new Error("unexpected"); },
      startedAt: new Date("2026-07-22T02:00:00.000Z"), now: () => Date.parse("2026-07-22T02:00:00.000Z"),
    });
    expect(claimWindow).not.toHaveBeenCalled();
  });

  test("logs stable lifecycle actions with aggregate counters and duration", async () => {
    const lifecycleLogs: PurchaseRecurrenceLifecycleLogInput[] = [];
    const logLifecycle = async (input: PurchaseRecurrenceLifecycleLogInput) => { lifecycleLogs.push(input); };
    await runPurchaseRecurrenceWorkflow({ mode: "RECONCILE" }, {
      ...freshWindow,
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
    const claimWindow = mock(async () => ({ since: "unused", fullSweep: false }));
    const commitWindow = mock(async () => {});
    const result = await runPurchaseRecurrenceWorkflow({ mode: "BACKFILL", today: "2026-07-22", totals: { processed: 10000, updated: 8000, failed: 0 } }, {
      claimWindow, commitWindow,
      recalculate: async () => emptyPage, rebuild, logLifecycle: async () => {}, continueAsNew: async () => { throw new Error("unexpected"); }, startedAt: new Date("2026-07-22T10:00:00.000Z"), now: () => Date.parse("2026-07-22T10:00:01.000Z"),
    });
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(rebuild).toHaveBeenCalledWith({ target: "facilities" });
    expect(result.finalRebuildCompleted).toBe(true);
    // BACKFILL has no window of its own; it must not touch the reconcile one.
    expect(claimWindow).not.toHaveBeenCalled();
    expect(commitWindow).not.toHaveBeenCalled();
  });
});
