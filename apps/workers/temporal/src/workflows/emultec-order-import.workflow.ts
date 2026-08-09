import {
  log,
  proxyActivities,
  startChild,
  ParentClosePolicy,
  workflowInfo,
} from "@temporalio/workflow";

export const EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY = { maximumAttempts: 3 } as const;

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "30 minutes",
  retry: EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY,
});

export type EmultecOrderImportMode =
  | "BACKFILL"
  | "INCREMENTAL"
  | "RECONCILE"
  | "HYBRID";

export type EmultecOrderImportWorkflowInput = {
  mode?: EmultecOrderImportMode;
  /** Exclusive watermark on avulsa.id; INCREMENTAL/BACKFILL. Default: CRM max for INCREMENTAL/HYBRID, else 0. */
  afterId?: number;
  /** Page size (capped in activity). Default 100. */
  pageSize?: number;
  /** Stop after this many pages per phase (safety). Default unlimited. */
  maxPages?: number;
  /** RECONCILE / HYBRID: lookback days for Data/Finalizado/Sem_Faturamento. Default 30. */
  reconcileDays?: number;
  /** RECONCILE / HYBRID: explicit YYYY-MM-DD (overrides reconcileDays). */
  sinceDate?: string;
  /** After upserts, start purchase-recurrence RECONCILE for changed orders. Default true for HYBRID. */
  triggerPurchaseRecurrence?: boolean;
};

export type EmultecOrderImportWorkflowResult = {
  mode: EmultecOrderImportMode;
  runId: number;
  pages: number;
  fetched: number;
  upserted: number;
  skipped: number;
  lastId: number | null;
  watermarkBefore: number;
  watermarkAfter: number;
  skipReasons: Record<string, number>;
  facilityIds: number[];
  purchaseRecurrenceWorkflowId: string | null;
};

function mergeSkipReasons(
  into: Record<string, number>,
  from: Record<string, number>
) {
  for (const [key, count] of Object.entries(from)) {
    into[key] = (into[key] ?? 0) + count;
  }
}

function sinceDateFromDays(days: number, nowIso: string): string {
  const now = new Date(nowIso);
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function runPhase(input: {
  mode: "BACKFILL" | "INCREMENTAL" | "RECONCILE" | "DLQ_REPLAY";
  afterId: number;
  pageSize: number;
  maxPages: number;
  sinceDate?: string;
}): Promise<{
  pages: number;
  fetched: number;
  upserted: number;
  skipped: number;
  lastId: number | null;
  skipReasons: Record<string, number>;
  facilityIds: number[];
}> {
  let afterId = input.afterId;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let lastId: number | null = afterId || null;
  const skipReasons: Record<string, number> = {};
  const facilityIds = new Set<number>();

  while (pages < input.maxPages) {
    const page = await activities.importEmultecOrdersPageActivity({
      mode: input.mode,
      afterId,
      limit: input.pageSize,
      sinceDate: input.sinceDate,
    });
    pages += 1;
    fetched += page.fetched;
    upserted += page.upserted;
    skipped += page.skipped;
    mergeSkipReasons(skipReasons, page.skipReasons);
    for (const id of page.facilityIds) facilityIds.add(id);
    if (page.lastId == null) break;
    const progressed = page.lastId > afterId;
    lastId = page.lastId;
    afterId = page.lastId;
    // Empty fetch with no cursor move → done. Empty fetch that advanced (DLQ miss) → continue.
    if (page.fetched === 0 && !progressed) break;
    if (page.fetched > 0 && page.fetched < input.pageSize) break;
    if (page.fetched === 0 && progressed) continue;
  }

  return {
    pages,
    fetched,
    upserted,
    skipped,
    lastId,
    skipReasons,
    facilityIds: [...facilityIds],
  };
}

/**
 * Emultec avulsa → CRM orders.
 *
 * HYBRID = DLQ replay → RECONCILE → INCREMENTAL.
 */
export async function emultecOrderImportWorkflow(
  input: EmultecOrderImportWorkflowInput = {}
): Promise<EmultecOrderImportWorkflowResult> {
  const mode = input.mode ?? "HYBRID";
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? Number.POSITIVE_INFINITY;
  const reconcileDays = input.reconcileDays ?? 30;
  const startedAt = new Date(workflowInfo().startTime);
  const nowIso = startedAt.toISOString();
  const sinceDate =
    input.sinceDate ?? sinceDateFromDays(reconcileDays, nowIso);
  const workflowId = workflowInfo().workflowId;

  const configured = await activities.isEmultecConfiguredActivity();
  if (!configured) {
    log.warn(
      "emultec.order_import.not_configured — EMULTEC_MYSQL_HOST/USER/PASSWORD missing, skipping run"
    );
    return {
      mode,
      runId: 0,
      pages: 0,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      lastId: null,
      watermarkBefore: 0,
      watermarkAfter: 0,
      skipReasons: {},
      facilityIds: [],
      purchaseRecurrenceWorkflowId: null,
    };
  }

  const watermarkBefore = await activities.getEmultecOrderWatermarkActivity();
  const afterIdDefault =
    mode === "BACKFILL" ? (input.afterId ?? 0) : (input.afterId ?? watermarkBefore);

  const runId = await activities.startEmultecImportRunActivity({
    mode,
    workflowId,
    watermarkBefore,
  });

  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let lastId: number | null = null;
  const skipReasons: Record<string, number> = {};
  const facilityIds = new Set<number>();

  const absorb = (phase: Awaited<ReturnType<typeof runPhase>>) => {
    pages += phase.pages;
    fetched += phase.fetched;
    upserted += phase.upserted;
    skipped += phase.skipped;
    mergeSkipReasons(skipReasons, phase.skipReasons);
    for (const id of phase.facilityIds) facilityIds.add(id);
    if (phase.lastId != null) lastId = phase.lastId;
  };

  try {
    if (mode === "HYBRID") {
      absorb(
        await runPhase({
          mode: "DLQ_REPLAY",
          afterId: 0,
          pageSize,
          maxPages,
        })
      );
      absorb(
        await runPhase({
          mode: "RECONCILE",
          afterId: 0,
          pageSize,
          maxPages,
          sinceDate,
        })
      );
      absorb(
        await runPhase({
          mode: "INCREMENTAL",
          afterId: afterIdDefault,
          pageSize,
          maxPages,
        })
      );
    } else if (mode === "RECONCILE") {
      absorb(
        await runPhase({
          mode: "RECONCILE",
          afterId: input.afterId ?? 0,
          pageSize,
          maxPages,
          sinceDate,
        })
      );
    } else {
      absorb(
        await runPhase({
          mode: mode === "INCREMENTAL" ? "INCREMENTAL" : "BACKFILL",
          afterId: afterIdDefault,
          pageSize,
          maxPages,
        })
      );
    }

    const watermarkAfter = await activities.getEmultecOrderWatermarkActivity();

    const triggerRecurrence =
      input.triggerPurchaseRecurrence ?? mode === "HYBRID";
    let purchaseRecurrenceWorkflowId: string | null = null;
    if (triggerRecurrence && upserted > 0) {
      purchaseRecurrenceWorkflowId = `purchase-recurrence-after-emultec-${workflowId}`;
      const since = new Date(startedAt.getTime() - 5 * 60_000).toISOString();
      const until = new Date(startedAt.getTime() + 6 * 60 * 60_000).toISOString();
      await startChild("purchaseRecurrenceWorkflow", {
        workflowId: purchaseRecurrenceWorkflowId,
        args: [
          {
            mode: "RECONCILE" as const,
            since,
            until,
          },
        ],
        parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
      });
    }

    await activities.finishEmultecImportRunActivity({
      runId,
      status: "SUCCEEDED",
      fetched,
      upserted,
      skipped,
      skipReasons,
      watermarkAfter,
    });

    return {
      mode,
      runId,
      pages,
      fetched,
      upserted,
      skipped,
      lastId,
      watermarkBefore,
      watermarkAfter,
      skipReasons,
      facilityIds: [...facilityIds],
      purchaseRecurrenceWorkflowId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let watermarkAfter = watermarkBefore;
    try {
      watermarkAfter = await activities.getEmultecOrderWatermarkActivity();
    } catch {
      // ignore
    }
    await activities.finishEmultecImportRunActivity({
      runId,
      status: "FAILED",
      fetched,
      upserted,
      skipped,
      skipReasons,
      watermarkAfter,
      errorMessage: message,
    });
    throw error;
  }
}
