import { describe, expect, test } from "bun:test";
import {
  runMetricSnapshotWorkflow,
  type MetricSnapshotWorkflowInput,
} from "./metric-snapshot.workflow";
import type {
  MetricSnapshotBatchInput,
  MetricSnapshotBatchResult,
  MetricSnapshotLifecycleLogInput,
} from "../activities/metric-snapshot.activities";

/**
 * The sweep's control flow, with every dependency injected — no Temporal
 * harness, no database, no clock.
 *
 * What matters here is paging, the watermark it hands the activity, and that a
 * run which finds stale rows *says so*. A sweep that silently repairs is the
 * counter-instead-of-an-alarm spec 0013 §4.4 exists to avoid.
 */

function page(overrides: Partial<MetricSnapshotBatchResult> = {}): MetricSnapshotBatchResult {
  return {
    processed: 0,
    written: 0,
    differed: 0,
    failed: 0,
    nextCursor: null,
    failures: [],
    ...overrides,
  };
}

function createDependencies(pages: MetricSnapshotBatchResult[]) {
  const calls: MetricSnapshotBatchInput[] = [];
  const logs: MetricSnapshotLifecycleLogInput[] = [];
  let index = 0;
  return {
    calls,
    logs,
    continued: [] as MetricSnapshotWorkflowInput[],
    dependencies: {
      recalculate: async (input: MetricSnapshotBatchInput) => {
        calls.push(input);
        return pages[index++] ?? page();
      },
      logLifecycle: async (input: MetricSnapshotLifecycleLogInput) => {
        logs.push(input);
      },
      continueAsNew: async (next: MetricSnapshotWorkflowInput) => {
        throw new Error(`unexpected continueAsNew: ${JSON.stringify(next)}`);
      },
      windowMonths: (_instant: Date, count: number) =>
        Array.from({ length: count }, (_, i) => `2026-0${i + 1}-01`),
      startedAt: new Date("2026-03-15T10:00:00.000Z"),
      now: () => Date.parse("2026-03-15T10:00:05.000Z"),
    },
  };
}

describe("runMetricSnapshotWorkflow", () => {
  test("pages until a page returns no rows, carrying the cursor forward", async () => {
    const harness = createDependencies([
      page({ processed: 2, written: 4, nextCursor: 20 }),
      page({ processed: 1, written: 2, nextCursor: 33 }),
      page({ processed: 0, nextCursor: null }),
    ]);

    const totals = await runMetricSnapshotWorkflow(
      { mode: "RECONCILE" },
      harness.dependencies,
    );

    expect(harness.calls.map((call) => call.cursor)).toEqual([null, 20, 33]);
    expect(totals.processed).toBe(3);
    expect(totals.written).toBe(6);
  });

  test("RECONCILE derives a half-open window ending at the scheduled instant", async () => {
    const harness = createDependencies([page()]);
    await runMetricSnapshotWorkflow({ mode: "RECONCILE" }, harness.dependencies);

    const [call] = harness.calls;
    expect(call!.until).toBe("2026-03-15T10:00:00.000Z");
    // Two hours of lookback against an hourly schedule, so a skipped or delayed
    // run does not leave a gap no later run ever looks at.
    expect(call!.since).toBe("2026-03-15T08:00:00.000Z");
  });

  test("NIGHTLY visits every profile and sends no watermark window", async () => {
    // The nightly pass exists because `ours` is a rolling 90-day window: a
    // clinic's value moves as orders age out of it, with no event for a
    // watermark to select. So it must not be given one.
    const harness = createDependencies([page()]);
    await runMetricSnapshotWorkflow({ mode: "NIGHTLY" }, harness.dependencies);

    const [call] = harness.calls;
    expect(call!.mode).toBe("NIGHTLY");
    expect(call!.since).toBeUndefined();
    expect(call!.until).toBeUndefined();
  });

  test("TRIGGER carries the named profiles through, and sends no window", async () => {
    const harness = createDependencies([page({ processed: 1, written: 1, nextCursor: null })]);

    await runMetricSnapshotWorkflow(
      { mode: "TRIGGER", profileIds: [42] },
      harness.dependencies,
    );

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]!.profileIds).toEqual([42]);
    expect(harness.calls[0]!.since).toBeUndefined();
    expect(harness.calls[0]!.until).toBeUndefined();
    // Named as a trigger in the log, not as a sweep — otherwise a reconcile
    // count would include every order write.
    expect(harness.logs.map((log) => log.action)).toEqual([
      "facility_metric_snapshot.trigger_started",
      "facility_metric_snapshot.trigger_completed",
    ]);
  });

  test("reports differed, so a lost trigger reaches the log instead of being healed quietly", async () => {
    const harness = createDependencies([
      page({ processed: 5, written: 15, differed: 4, nextCursor: 9 }),
      page({ processed: 0, nextCursor: null }),
    ]);

    const totals = await runMetricSnapshotWorkflow(
      { mode: "RECONCILE" },
      harness.dependencies,
    );

    expect(totals.differed).toBe(4);
    const completed = harness.logs.find((log) =>
      log.action.endsWith("reconcile_completed"),
    );
    expect(completed?.differed).toBe(4);
  });

  test("a failed profile is carried into the completion log, not dropped", async () => {
    const harness = createDependencies([
      page({ processed: 3, failed: 1, nextCursor: 3 }),
      page({ processed: 0, nextCursor: null }),
    ]);

    const totals = await runMetricSnapshotWorkflow(
      { mode: "RECONCILE" },
      harness.dependencies,
    );

    expect(totals.failed).toBe(1);
    expect(
      harness.logs.find((log) => log.action.endsWith("reconcile_completed"))?.failed,
    ).toBe(1);
  });

  test("logs start and completion exactly once for a run", async () => {
    const harness = createDependencies([page()]);
    await runMetricSnapshotWorkflow({ mode: "RECONCILE" }, harness.dependencies);

    expect(harness.logs.map((log) => log.action)).toEqual([
      "facility_metric_snapshot.reconcile_started",
      "facility_metric_snapshot.reconcile_completed",
    ]);
  });

  test("a continued run does not log a second start", async () => {
    const harness = createDependencies([page()]);
    await runMetricSnapshotWorkflow(
      { mode: "RECONCILE", lifecycleStartedAt: "2026-03-15T09:00:00.000Z" },
      harness.dependencies,
    );

    expect(harness.logs.map((log) => log.action)).toEqual([
      "facility_metric_snapshot.reconcile_completed",
    ]);
  });

  test("totals resume from a continued run rather than restarting at zero", async () => {
    const harness = createDependencies([page({ processed: 1, written: 2, differed: 1 })]);
    const totals = await runMetricSnapshotWorkflow(
      {
        mode: "RECONCILE",
        lifecycleStartedAt: "2026-03-15T09:00:00.000Z",
        totals: { processed: 10, written: 20, differed: 3, failed: 1 },
      },
      harness.dependencies,
    );

    expect(totals).toEqual({ processed: 11, written: 22, differed: 4, failed: 1 });
  });

});
