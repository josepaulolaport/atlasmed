import { continueAsNew, proxyActivities, workflowInfo } from "@temporalio/workflow";
import { monthKeyAt, trailingMonths } from "@atlasmed/facility-insights";
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

/**
 * How many trailing months a reconciliation run recomputes.
 *
 * The displayed figure averages a trailing window (spec 0013 §4.3), so an order
 * landing today moves what a reader sees for the two preceding months as well.
 * Recomputing only the current month would leave those stale.
 */
const RECONCILE_WINDOW_MONTHS = 3;

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
  /** Explicit months. BACKFILL and TRIGGER require them; RECONCILE derives its window. */
  months?: string[];
  /** TRIGGER only: the profiles an order write named. */
  profileIds?: number[];
  cursor?: number | null;
  since?: string;
  until?: string;
  totals?: MetricSnapshotWorkflowTotals;
  lifecycleStartedAt?: string;
}

export type MetricSnapshotWorkflowResult = MetricSnapshotWorkflowTotals;

const LIFECYCLE_ACTIONS: Record<MetricSnapshotMode, { started: string; completed: string }> = {
  RECONCILE: {
    started: "facility_metric_snapshot.reconcile_started",
    completed: "facility_metric_snapshot.reconcile_completed",
  },
  BACKFILL: {
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
  continueAsNew(input: MetricSnapshotWorkflowInput): Promise<never>;
  windowMonths(instant: Date, monthsInWindow: number): string[];
  startedAt?: Date;
  now?: () => number;
}

export async function runMetricSnapshotWorkflow(
  input: MetricSnapshotWorkflowInput,
  dependencies: WorkflowDependencies,
): Promise<MetricSnapshotWorkflowResult> {
  const scheduledAt = dependencies.startedAt ?? new Date(workflowInfo().startTime);
  const now = dependencies.now ?? Date.now;

  // The watermark defaults to twice the schedule interval, so a run that is
  // skipped or delayed does not leave a gap no later run ever looks at.
  const until = input.until ?? scheduledAt.toISOString();
  const since = input.since ?? new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1_000).toISOString();

  const months = input.months ?? dependencies.windowMonths(scheduledAt, RECONCILE_WINDOW_MONTHS);
  if (months.length === 0) {
    throw new Error("MetricSnapshotWorkflow requires at least one month");
  }

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
      months,
      ...totals,
      durationMs: 0,
    });
  }

  while (true) {
    const page = await dependencies.recalculate({
      mode: input.mode,
      cursor,
      limit: PAGE_SIZE,
      months,
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
        months,
        since,
        until,
        cursor,
        totals,
        lifecycleStartedAt,
      });
    }
  }

  await dependencies.logLifecycle({
    action: LIFECYCLE_ACTIONS[input.mode].completed,
    mode: input.mode,
    months,
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
    continueAsNew: (nextInput) => continueAsNew<typeof metricSnapshotWorkflow>(nextInput),
    // Imported from the package, not reimplemented here. It is safe inside a
    // workflow because it is pure — it takes the instant as an argument and
    // reads no clock — and because `@atlasmed/facility-insights` touches no
    // database at import time, which is the constraint that actually applies to
    // workflow bundles. Importing the *activities* module would not be safe: it
    // reaches for `getDb`.
    windowMonths: (instant, monthsInWindow) =>
      trailingMonths(monthKeyAt(instant), monthsInWindow),
  });
}
