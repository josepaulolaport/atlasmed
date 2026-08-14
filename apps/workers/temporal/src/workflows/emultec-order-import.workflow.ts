import {
  ContinueAsNew,
  continueAsNew,
  log,
  proxyActivities,
  sleep,
  startChild,
  ParentClosePolicy,
  workflowInfo,
} from "@temporalio/workflow";

export const EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY = { maximumAttempts: 3 } as const;

/** Safety cap on pages per phase when the caller does not set one. */
export const DEFAULT_MAX_PAGES = 50;

/**
 * Pause between pages, so a run reads Emultec in steady sips rather than as
 * fast as their server can answer. At 200 rows a page this is roughly 400
 * rows/second — ample for the volume, gentle on a database we do not own.
 */
export const PAGE_DELAY_MS = 500;

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "30 minutes",
  retry: EMULTEC_ORDER_IMPORT_ACTIVITY_RETRY,
});

export type EmultecOrderImportMode =
  | "BACKFILL"
  | "INCREMENTAL"
  | "RECONCILE"
  /** Re-check locally-blocked skips only. Reads Emultec solely for what flipped. */
  | "SKIP_RECHECK"
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
  /**
   * Set only by `continueAsNew`, never by a caller.
   *
   * A BACKFILL that exceeds its page budget continues into a fresh workflow run
   * carrying this, so the cursor, the run digest row and the totals survive the
   * boundary. Without it a BACKFILL restarts at `afterId = 0` every time,
   * covering the same first `maxPages * pageSize` orders forever while
   * reporting success — with the shipped defaults that is 5 000 of 18 500.
   */
  resume?: EmultecOrderImportResume;
};

export type EmultecOrderImportResume = {
  runId: number;
  /** Original run start, so the recurrence window still covers earlier legs. */
  startedAtIso: string;
  afterId: number;
  /** Guards against an unbounded continuation chain if a cursor ever stalls. */
  leg: number;
  pages: number;
  fetched: number;
  upserted: number;
  changed: number;
  skipped: number;
  linkFailures: number;
  skipReasons: Record<string, number>;
  facilityIds: number[];
};

/**
 * Hard stop on the continuation chain. At the 200-row page size a backfill uses
 * one leg per `maxPages * pageSize` orders — two legs for today's ~18 500 — so
 * this only ever fires if a cursor stops advancing.
 */
export const MAX_BACKFILL_LEGS = 50;

export type BackfillContinuation =
  | { kind: "stop" }
  | { kind: "leg_cap"; leg: number; afterId: number }
  | { kind: "continue"; resume: EmultecOrderImportResume };

/**
 * Whether a finished phase should hand over to a fresh workflow run, and with
 * what.
 *
 * Pure and exported so the decision *and the payload* are testable without a
 * Temporal environment — the payload is the part that bites, since a total left
 * out here is silently reset to zero on the next leg and the run digest
 * under-reports for the rest of the backfill.
 */
export function planBackfillContinuation(input: {
  mode: EmultecOrderImportMode;
  phase: { hitPageCap: boolean; lastId: number | null };
  afterId: number;
  /**
   * Whether the caller pinned `maxPages`.
   *
   * If they did, that is a bound they asked for and continuing would quietly
   * ignore it — `maxPages: 5` must mean five pages, not five pages per leg
   * until the history runs out. Continuation is for the unpinned case, where
   * `maxPages` only keeps any single leg from reading a third-party database
   * without limit.
   */
  maxPagesPinned: boolean;
  leg: number;
  runId: number;
  startedAtIso: string;
  totals: Omit<
    EmultecOrderImportResume,
    "runId" | "startedAtIso" | "afterId" | "leg"
  >;
}): BackfillContinuation {
  /**
   * Only BACKFILL continues. INCREMENTAL is bounded by the watermark, and
   * HYBRID runs on a 10-minute schedule where the page cap is the protection
   * against reading a third-party database without limit.
   */
  if (input.mode !== "BACKFILL") return { kind: "stop" };
  if (input.maxPagesPinned) return { kind: "stop" };
  if (!input.phase.hitPageCap) return { kind: "stop" };
  if (input.phase.lastId == null) return { kind: "stop" };
  // No forward progress means continuing would repeat the same page forever.
  if (input.phase.lastId <= input.afterId) return { kind: "stop" };

  const leg = input.leg + 1;
  if (leg >= MAX_BACKFILL_LEGS) {
    return { kind: "leg_cap", leg, afterId: input.phase.lastId };
  }

  return {
    kind: "continue",
    resume: {
      runId: input.runId,
      startedAtIso: input.startedAtIso,
      afterId: input.phase.lastId,
      leg,
      ...input.totals,
    },
  };
}

export type EmultecOrderImportWorkflowResult = {
  mode: EmultecOrderImportMode;
  runId: number;
  pages: number;
  fetched: number;
  upserted: number;
  /** Of `upserted`, how many actually wrote a row. Drives downstream work. */
  changed: number;
  skipped: number;
  /** Orders imported whose `facility_emultec_clients` link could not be written. */
  linkFailures: number;
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
  mode:
    | "BACKFILL"
    | "INCREMENTAL"
    | "RECONCILE"
    | "DLQ_REPLAY"
    | "SKIP_RECHECK";
  afterId: number;
  pageSize: number;
  maxPages: number;
  sinceDate?: string;
}): Promise<{
  pages: number;
  fetched: number;
  upserted: number;
  changed: number;
  skipped: number;
  linkFailures: number;
  lastId: number | null;
  skipReasons: Record<string, number>;
  facilityIds: number[];
  /**
   * True when the loop stopped because it ran out of page budget rather than
   * because Emultec ran out of rows — i.e. there is more history behind this
   * cursor. A BACKFILL that ignores this reports success having covered only
   * its first `maxPages`.
   */
  hitPageCap: boolean;
}> {
  let afterId = input.afterId;
  let pages = 0;
  let fetched = 0;
  let upserted = 0;
  let changed = 0;
  let skipped = 0;
  let linkFailures = 0;
  let lastId: number | null = afterId || null;
  const skipReasons: Record<string, number> = {};
  const facilityIds = new Set<number>();
  let exhausted = false;

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
    changed += page.changed;
    skipped += page.skipped;
    linkFailures += page.linkFailures;
    mergeSkipReasons(skipReasons, page.skipReasons);
    for (const id of page.facilityIds) facilityIds.add(id);
    if (page.lastId == null) {
      exhausted = true;
      break;
    }
    const progressed = page.lastId > afterId;
    lastId = page.lastId;
    afterId = page.lastId;
    // Empty fetch with no cursor move → done. Empty fetch that advanced (DLQ miss) → continue.
    if (page.fetched === 0 && !progressed) {
      exhausted = true;
      break;
    }
    if (page.fetched > 0 && page.fetched < input.pageSize) {
      exhausted = true;
      break;
    }
    if (page.fetched === 0 && progressed) continue;

    // Only between pages we are actually going to follow — never after the last.
    await sleep(PAGE_DELAY_MS);
  }

  return {
    pages,
    fetched,
    upserted,
    changed,
    skipped,
    linkFailures,
    lastId,
    skipReasons,
    facilityIds: [...facilityIds],
    hitPageCap: !exhausted,
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
  /**
   * Emultec is a third-party production database. An unbounded page loop is a
   * promise to read their entire order history as fast as they can serve it,
   * every time this runs — and the schedule fires every 10 minutes.
   *
   * 50 pages x 200 rows covers ~10k orders per run, far more than a 10-minute
   * window can produce. A genuine backfill passes maxPages explicitly and is
   * run deliberately, not on a timer.
   */
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const reconcileDays = input.reconcileDays ?? 30;
  const resume = input.resume;
  // A continued backfill keeps the original start so the purchase-recurrence
  // window at the end still covers orders written by earlier legs.
  const startedAt = new Date(
    resume?.startedAtIso ?? workflowInfo().startTime
  );
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
      changed: 0,
      skipped: 0,
      linkFailures: 0,
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
    resume?.afterId ??
    (mode === "BACKFILL"
      ? (input.afterId ?? 0)
      : (input.afterId ?? watermarkBefore));

  // One digest row per logical backfill, not one per leg.
  const runId =
    resume?.runId ??
    (await activities.startEmultecImportRunActivity({
      mode,
      workflowId,
      watermarkBefore,
    }));

  let pages = resume?.pages ?? 0;
  let fetched = resume?.fetched ?? 0;
  let upserted = resume?.upserted ?? 0;
  let changed = resume?.changed ?? 0;
  let skipped = resume?.skipped ?? 0;
  let linkFailures = resume?.linkFailures ?? 0;
  let lastId: number | null = resume?.afterId ?? null;
  const skipReasons: Record<string, number> = { ...(resume?.skipReasons ?? {}) };
  const facilityIds = new Set<number>(resume?.facilityIds ?? []);

  const absorb = (phase: Awaited<ReturnType<typeof runPhase>>) => {
    pages += phase.pages;
    fetched += phase.fetched;
    upserted += phase.upserted;
    changed += phase.changed;
    skipped += phase.skipped;
    linkFailures += phase.linkFailures;
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
      /**
       * Skipped orders whose blocker cleared since the last run.
       *
       * This runs before RECONCILE deliberately. RECONCILE asks Emultec what
       * changed *there*, and a skip is almost never waiting on Emultec — it is
       * waiting on a rep being mapped, a clinic being created, a CPF being
       * corrected here. No date window over their data can see any of that, so
       * without this phase those orders were invisible until someone remembered
       * to run a manual backfill.
       *
       * It costs nothing when nothing changed: the id list comes from our own
       * tables, and an empty list means Emultec is never contacted at all.
       */
      absorb(
        await runPhase({
          mode: "SKIP_RECHECK",
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
    } else if (mode === "SKIP_RECHECK") {
      absorb(
        await runPhase({
          mode: "SKIP_RECHECK",
          afterId: input.afterId ?? 0,
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
      const phase = await runPhase({
        mode: mode === "INCREMENTAL" ? "INCREMENTAL" : "BACKFILL",
        afterId: afterIdDefault,
        pageSize,
        maxPages,
      });
      absorb(phase);

      /**
       * A BACKFILL that filled its page budget has more history behind the
       * cursor. Continue into a fresh run rather than stopping: the alternative
       * is what shipped — report success having covered `maxPages * pageSize`
       * orders, then start again from the same place on the next trigger.
       */
      const continuation = planBackfillContinuation({
        mode,
        phase,
        afterId: afterIdDefault,
        maxPagesPinned: input.maxPages != null,
        leg: resume?.leg ?? 0,
        runId,
        startedAtIso: startedAt.toISOString(),
        totals: {
          pages,
          fetched,
          upserted,
          changed,
          skipped,
          linkFailures,
          skipReasons,
          facilityIds: [...facilityIds],
        },
      });

      if (continuation.kind === "leg_cap") {
        log.warn("emultec.order_import.backfill_leg_cap", {
          leg: continuation.leg,
          afterId: continuation.afterId,
        });
      } else if (continuation.kind === "continue") {
        // The courtesy that applies between pages applies across the boundary
        // too — continuing must not become a way to skip the pacing.
        await sleep(PAGE_DELAY_MS);
        await continueAsNew<typeof emultecOrderImportWorkflow>({
          ...input,
          resume: continuation.resume,
        });
      }
    }

    const watermarkAfter = await activities.getEmultecOrderWatermarkActivity();

    const triggerRecurrence =
      input.triggerPurchaseRecurrence ?? mode === "HYBRID";
    let purchaseRecurrenceWorkflowId: string | null = null;
    // `changed`, not `upserted`: a HYBRID run that re-read the same unchanged
    // orders has nothing for the recurrence workflow to recalculate, and its
    // window over `orders.updated_at` would now select nothing anyway.
    if (triggerRecurrence && changed > 0) {
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
      changed,
      skipped,
      linkFailures,
      skipReasons,
      watermarkAfter,
    });

    return {
      mode,
      runId,
      pages,
      fetched,
      upserted,
      changed,
      skipped,
      linkFailures,
      lastId,
      watermarkBefore,
      watermarkAfter,
      skipReasons,
      facilityIds: [...facilityIds],
      purchaseRecurrenceWorkflowId,
    };
  } catch (error) {
    /**
     * `continueAsNew` unwinds the workflow by throwing. It is a handover, not a
     * failure — letting it fall through here would mark the run FAILED and
     * finish its digest on every backfill leg, then re-throw into a successful
     * continuation. The digest must stay RUNNING until the final leg.
     */
    if (error instanceof ContinueAsNew) throw error;

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
      changed,
      skipped,
      linkFailures,
      skipReasons,
      watermarkAfter,
      errorMessage: message,
    });
    throw error;
  }
}
