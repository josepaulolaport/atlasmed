import { continueAsNew, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type {
  MetricSnapshotBatchInput,
  MetricSnapshotBatchResult,
  MetricSnapshotLifecycleLogInput,
  MetricSnapshotMode,
} from "../activities/metric-snapshot.activities";

export const METRIC_SNAPSHOT_ACTIVITY_OPTIONS = {
  startToCloseTimeout: "30 minutes",
  retry: {
    maximumAttempts: 5,
    initialInterval: "5 seconds",
    backoffCoefficient: 2,
    maximumInterval: "2 minutes",
  },
} as const;

const PAGE_SIZE = 500;
const CONTINUE_AS_NEW_AFTER = 10_000;


const activities = proxyActivities<typeof import("../activities/index")>(
  METRIC_SNAPSHOT_ACTIVITY_OPTIONS,
);

export interface MetricSnapshotWorkflowTotals {
  processed: number;
  written: number;
  differed: number;
  failed: number;
}

export interface MetricSnapshotWorkflowInput {
  mode: MetricSnapshotMode;
  /** TRIGGER only: the profiles an order write named. */
  profileIds?: number[];
  cursor?: number | null;
  since?: string;
  until?: string;
  /**
   * Whether this run is the one allowed to advance the reconcile watermark.
   *
   * Set when a run claims a window of its own, and carried through
   * `continueAsNew` so a long run still commits at the end of the chain rather
   * than leaving the watermark where it started.
   */
  ownsWatermark?: boolean;
  totals?: MetricSnapshotWorkflowTotals;
  lifecycleStartedAt?: string;
}

export type MetricSnapshotWorkflowResult = MetricSnapshotWorkflowTotals;

const LIFECYCLE_ACTIONS: Record<MetricSnapshotMode, { started: string; completed: string }> = {
  RECONCILE: {
    started: "facility_metric_snapshot.reconcile_started",
    completed: "facility_metric_snapshot.reconcile_completed",
  },
  NIGHTLY: {
    started: "facility_metric_snapshot.backfill_started",
    completed: "facility_metric_snapshot.backfill_completed",
  },
  TRIGGER: {
    started: "facility_metric_snapshot.trigger_started",
    completed: "facility_metric_snapshot.trigger_completed",
  },
};

interface WorkflowDependencies {
  recalculate(input: MetricSnapshotBatchInput): Promise<MetricSnapshotBatchResult>;
  logLifecycle(input: MetricSnapshotLifecycleLogInput): Promise<void>;
  claimWindow(input: { until: string }): Promise<{ since: string }>;
  commitWindow(input: { until: string }): Promise<void>;
  continueAsNew(input: MetricSnapshotWorkflowInput): Promise<never>;
  startedAt?: Date;
  now?: () => number;
}

export async function runMetricSnapshotWorkflow(
  input: MetricSnapshotWorkflowInput,
  dependencies: WorkflowDependencies,
): Promise<MetricSnapshotWorkflowResult> {
  const scheduledAt = dependencies.startedAt ?? new Date(workflowInfo().startTime);
  const now = dependencies.now ?? Date.now;

  const until = input.until ?? scheduledAt.toISOString();
  /**
   * The window comes from a stored watermark, not from a fixed lookback.
   *
   * `start - 2h` was described here as a watermark and is not one. Under overlap
   * `SKIP` a run that overruns causes the next firings to be skipped, and the
   * run that does fire looks back two hours from *itself* — so the hours in
   * between are covered by nobody. NIGHTLY does not repair it: it visits every
   * profile but recomputes from current state, so an order change that has since
   * aged out of the rolling 90-day window is simply gone.
   *
   * Already resolved on a `continueAsNew`; NIGHTLY and TRIGGER have no window.
   */
  const ownsWatermark =
    input.ownsWatermark ?? (input.mode === "RECONCILE" && input.since === undefined);
  const claimed =
    ownsWatermark && input.since === undefined
      ? await dependencies.claimWindow({ until })
      : null;
  const since =
    input.since ?? claimed?.since
    ?? new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1_000).toISOString();


  const lifecycleStartedAt = input.lifecycleStartedAt ?? scheduledAt.toISOString();
  const totals: MetricSnapshotWorkflowTotals = {
    processed: 0,
    written: 0,
    differed: 0,
    failed: 0,
    ...input.totals,
  };
  let cursor = input.cursor ?? null;
  let processedThisRun = 0;

  if (!input.lifecycleStartedAt) {
    await dependencies.logLifecycle({
      action: LIFECYCLE_ACTIONS[input.mode].started,
      mode: input.mode,
      ...totals,
      durationMs: 0,
    });
  }

  while (true) {
    const page = await dependencies.recalculate({
      mode: input.mode,
      cursor,
      limit: PAGE_SIZE,
      ...(input.mode === "RECONCILE" ? { since, until } : {}),
      ...(input.mode === "TRIGGER" ? { profileIds: input.profileIds ?? [] } : {}),
    });
    totals.processed += page.processed;
    totals.written += page.written;
    totals.differed += page.differed;
    totals.failed += page.failed;
    processedThisRun += page.processed;

    if (page.processed === 0 || page.nextCursor === null) break;
    cursor = page.nextCursor;

    if (processedThisRun >= CONTINUE_AS_NEW_AFTER) {
      return dependencies.continueAsNew({
        ...input,
          since,
        until,
        ownsWatermark,
        cursor,
        totals,
        lifecycleStartedAt,
      });
    }
  }

  // After the last page, never before: the watermark records what has actually
  // been covered, so a run that dies mid-way leaves its window for the next one.
  if (ownsWatermark) {
    await dependencies.commitWindow({ until });
  }

  await dependencies.logLifecycle({
    action: LIFECYCLE_ACTIONS[input.mode].completed,
    mode: input.mode,
    ...totals,
    durationMs: Math.max(0, now() - Date.parse(lifecycleStartedAt)),
  });

  return totals;
}

export async function metricSnapshotWorkflow(
  input: MetricSnapshotWorkflowInput,
): Promise<MetricSnapshotWorkflowResult> {
  return runMetricSnapshotWorkflow(input, {
    recalculate: activities.recalculateMetricSnapshotsBatch,
    logLifecycle: activities.logMetricSnapshotLifecycle,
    claimWindow: activities.claimMetricSnapshotWindow,
    commitWindow: activities.commitMetricSnapshotWindow,
    continueAsNew: (nextInput) => continueAsNew<typeof metricSnapshotWorkflow>(nextInput),
  });
}
