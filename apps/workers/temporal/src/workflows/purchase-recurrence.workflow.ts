import { continueAsNew, proxyActivities, workflowInfo } from "@temporalio/workflow";
import { civilDateAt } from "@atlasmed/facility-insights";
import type {
  PurchaseRecurrenceBatchInput,
  PurchaseRecurrenceBatchResult,
  PurchaseRecurrenceLifecycleLogInput,
  PurchaseRecurrenceMode,
  ReconcileWindowPlan,
} from "../activities/purchase-recurrence.activities";

export const PURCHASE_RECURRENCE_ACTIVITY_OPTIONS = {
  startToCloseTimeout: "30 minutes",
  retry: {
    maximumAttempts: 5,
    initialInterval: "5 seconds",
    backoffCoefficient: 2,
    maximumInterval: "2 minutes",
  },
} as const;

export const PURCHASE_RECURRENCE_FINAL_REBUILD_ACTIVITY_OPTIONS = {
  startToCloseTimeout: "2 hours",
  retry: {
    maximumAttempts: 3,
    initialInterval: "30 seconds",
    backoffCoefficient: 2,
    maximumInterval: "10 minutes",
  },
} as const;

const PAGE_SIZE = 500;
const CONTINUE_AS_NEW_AFTER = 10_000;

const activities = proxyActivities<typeof import("../activities/index")>(PURCHASE_RECURRENCE_ACTIVITY_OPTIONS);
const finalRebuildActivities = proxyActivities<typeof import("../activities/index")>(PURCHASE_RECURRENCE_FINAL_REBUILD_ACTIVITY_OPTIONS);

export interface PurchaseRecurrenceWorkflowTotals {
  processed: number;
  updated: number;
  failed: number;
}

export interface PurchaseRecurrenceWorkflowInput {
  mode: PurchaseRecurrenceMode;
  today?: string;
  cursor?: number | null;
  since?: string;
  until?: string;
  fullSweep?: boolean;
  sourceCursor?: number | null;
  totals?: PurchaseRecurrenceWorkflowTotals;
  lifecycleStartedAt?: string;
  finalRebuildCompleted?: boolean;
}

export interface PurchaseRecurrenceWorkflowResult extends PurchaseRecurrenceWorkflowTotals {
  finalRebuildCompleted: boolean;
}

interface WorkflowDependencies {
  recalculate(input: PurchaseRecurrenceBatchInput): Promise<PurchaseRecurrenceBatchResult>;
  rebuild(input: { target: "facilities" }): Promise<void>;
  logLifecycle(input: PurchaseRecurrenceLifecycleLogInput): Promise<void>;
  claimWindow(input: { until: string }): Promise<ReconcileWindowPlan>;
  commitWindow(input: { until: string }): Promise<void>;
  continueAsNew(input: PurchaseRecurrenceWorkflowInput): Promise<never>;
  startedAt?: Date;
  now?: () => number;
}

export async function runPurchaseRecurrenceWorkflow(
  input: PurchaseRecurrenceWorkflowInput,
  dependencies: WorkflowDependencies,
): Promise<PurchaseRecurrenceWorkflowResult> {
  const scheduledAt = dependencies.startedAt ?? new Date(workflowInfo().startTime);
  const now = dependencies.now ?? Date.now;
  /**
   * The civil date in São Paulo, which is what a stage boundary means.
   *
   * `toISOString().slice(0, 10)` advanced the funnel's idea of "today" three
   * hours early — at 21:00 in Brazil. `civilDateAt` is pure and reads no clock,
   * so it is safe here; the instant still comes from `workflowInfo().startTime`
   * and is threaded through `continueAsNew` unchanged.
   */
  const today = input.today ?? civilDateAt(scheduledAt);
  const until = input.until ?? scheduledAt.toISOString();
  /**
   * The window comes from a watermark, not from a fixed lookback.
   *
   * `since = start - 2h` loses data under overlap policy `SKIP`: a run that
   * overruns causes the next firings to be skipped, and the run that does fire
   * looks back two hours from itself, so the hours between are covered by
   * nobody. The watermark is only advanced by a run that finished, so a skipped
   * or failed window is re-covered rather than stepped over.
   *
   * Already resolved on a `continueAsNew`, and BACKFILL has no window at all.
   */
  const plan: ReconcileWindowPlan | null =
    input.mode === "RECONCILE" && input.since === undefined
      ? await dependencies.claimWindow({ until })
      : null;
  const since =
    input.since ?? plan?.since
    ?? new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1_000).toISOString();
  /**
   * Only the caller decides this now.
   *
   * It used to be `scheduledAt.getUTCHours() === 0` on the shared hourly
   * schedule, so an overrunning 23:00 run skipped the midnight firing and with
   * it the daily repair — the one mechanism that heals everything the
   * incremental path misses. The sweep has its own schedule id now and cannot be
   * skipped by the hourly one. `plan.fullSweep` is the other entry: a watermark
   * left far enough behind is cheaper and safer to repair by sweeping.
   */
  const fullSweep = input.fullSweep ?? plan?.fullSweep ?? false;
  const sourceCursor = input.sourceCursor ?? input.cursor ?? null;
  const lifecycleStartedAt = input.lifecycleStartedAt ?? scheduledAt.toISOString();
  const totals = { processed: 0, updated: 0, failed: 0, ...input.totals };
  let cursor = input.cursor ?? null;
  let processedThisRun = 0;

  if (!input.lifecycleStartedAt) {
    await dependencies.logLifecycle({
      action: input.mode === "BACKFILL"
        ? "facility_purchase_recurrence.backfill_started"
        : "facility_purchase_recurrence.reconcile_started",
      mode: input.mode,
      today,
      fullSweep,
      ...totals,
      durationMs: 0,
    });
  }

  while (true) {
    const page = await dependencies.recalculate({
      mode: input.mode,
      cursor,
      limit: PAGE_SIZE,
      today,
      ...(input.mode === "RECONCILE" ? { since, until } : {}),
      fullSweep,
    });
    totals.processed += page.processed;
    totals.updated += page.updated;
    totals.failed += page.failed;
    processedThisRun += page.processed;

    if (page.processed === 0 || page.nextCursor === null) break;
    cursor = page.nextCursor;

    if (processedThisRun >= CONTINUE_AS_NEW_AFTER) {
      return dependencies.continueAsNew({
        ...input,
        today,
        since,
        until,
        fullSweep,
        cursor,
        sourceCursor,
        totals,
        lifecycleStartedAt,
        finalRebuildCompleted: input.finalRebuildCompleted ?? false,
      });
    }
  }

  let finalRebuildCompleted = input.finalRebuildCompleted ?? false;
  if (input.mode === "BACKFILL" && !finalRebuildCompleted) {
    await dependencies.rebuild({ target: "facilities" });
    finalRebuildCompleted = true;
  }

  // After the last page, never before: the watermark records what has actually
  // been covered, so a run that dies mid-way leaves its window for the next one.
  if (input.mode === "RECONCILE") {
    await dependencies.commitWindow({ until });
  }

  await dependencies.logLifecycle({
    action: input.mode === "BACKFILL"
      ? "facility_purchase_recurrence.backfill_completed"
      : "facility_purchase_recurrence.reconcile_completed",
    mode: input.mode,
    today,
    fullSweep,
    ...totals,
    durationMs: Math.max(0, now() - Date.parse(lifecycleStartedAt)),
  });

  return { ...totals, finalRebuildCompleted };
}

export async function purchaseRecurrenceWorkflow(
  input: PurchaseRecurrenceWorkflowInput,
): Promise<PurchaseRecurrenceWorkflowResult> {
  return runPurchaseRecurrenceWorkflow(input, {
    recalculate: activities.recalculatePurchaseRecurrenceBatch,
    rebuild: finalRebuildActivities.rebuildSearchIndexActivity,
    logLifecycle: activities.logPurchaseRecurrenceLifecycle,
    claimWindow: activities.claimPurchaseRecurrenceWindow,
    commitWindow: activities.commitPurchaseRecurrenceWindow,
    continueAsNew: (nextInput) => continueAsNew<typeof purchaseRecurrenceWorkflow>(nextInput),
  });
}
