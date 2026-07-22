import { continueAsNew, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type {
  PurchaseRecurrenceBatchInput,
  PurchaseRecurrenceBatchResult,
  PurchaseRecurrenceMode,
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

const PAGE_SIZE = 500;
const CONTINUE_AS_NEW_AFTER = 10_000;

const activities = proxyActivities<typeof import("../activities/index")>(PURCHASE_RECURRENCE_ACTIVITY_OPTIONS);

export interface PurchaseRecurrenceWorkflowTotals {
  processed: number;
  updated: number;
  failed: number;
}

export interface PurchaseRecurrenceWorkflowInput {
  mode: PurchaseRecurrenceMode;
  today?: string;
  cursor?: string | null;
  since?: string;
  until?: string;
  fullSweep?: boolean;
  totals?: PurchaseRecurrenceWorkflowTotals;
  finalRebuildCompleted?: boolean;
}

export interface PurchaseRecurrenceWorkflowResult extends PurchaseRecurrenceWorkflowTotals {
  finalRebuildCompleted: boolean;
}

interface WorkflowDependencies {
  recalculate(input: PurchaseRecurrenceBatchInput): Promise<PurchaseRecurrenceBatchResult>;
  rebuild(input: { target: "facilities" }): Promise<void>;
  continueAsNew(input: PurchaseRecurrenceWorkflowInput): Promise<never>;
  startedAt?: Date;
}

export async function runPurchaseRecurrenceWorkflow(
  input: PurchaseRecurrenceWorkflowInput,
  dependencies: WorkflowDependencies,
): Promise<PurchaseRecurrenceWorkflowResult> {
  const scheduledAt = dependencies.startedAt ?? new Date(workflowInfo().startTime);
  const today = input.today ?? scheduledAt.toISOString().slice(0, 10);
  const until = input.until ?? scheduledAt.toISOString();
  const since = input.since ?? new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1_000).toISOString();
  const totals = { processed: 0, updated: 0, failed: 0, ...input.totals };
  let cursor = input.cursor ?? null;
  let processedThisRun = 0;

  while (true) {
    const page = await dependencies.recalculate({
      mode: input.mode,
      cursor,
      limit: PAGE_SIZE,
      today,
      ...(input.mode === "RECONCILE" && !input.fullSweep ? { since, until } : {}),
      ...(input.fullSweep ? { fullSweep: true } : {}),
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
        cursor,
        totals,
        finalRebuildCompleted: input.finalRebuildCompleted ?? false,
      });
    }
  }

  let finalRebuildCompleted = input.finalRebuildCompleted ?? false;
  if (input.mode === "BACKFILL" && !finalRebuildCompleted) {
    await dependencies.rebuild({ target: "facilities" });
    finalRebuildCompleted = true;
  }

  return { ...totals, finalRebuildCompleted };
}

export async function purchaseRecurrenceWorkflow(
  input: PurchaseRecurrenceWorkflowInput,
): Promise<PurchaseRecurrenceWorkflowResult> {
  return runPurchaseRecurrenceWorkflow(input, {
    recalculate: activities.recalculatePurchaseRecurrenceBatch,
    rebuild: activities.rebuildSearchIndexActivity,
    continueAsNew: (nextInput) => continueAsNew<typeof purchaseRecurrenceWorkflow>(nextInput),
  });
}
