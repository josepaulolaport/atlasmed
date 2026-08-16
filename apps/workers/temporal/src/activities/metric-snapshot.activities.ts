import { ApplicationFailure } from "@temporalio/activity";
import {
  createMetricSnapshotStore,
  listAllProfileIds,
  listProfilesWithChangedInputs,
  RECONCILE_WATERMARKS,
  type AnyDatabase,
} from "@atlasmed/database";
import {
  recomputeMetricSnapshots,
} from "@atlasmed/facility-insights";
import { getDb } from "../infrastructure/db";
import {
  commitCoveredUntil,
  planReconcileWindow,
  readCoveredUntil,
} from "../infrastructure/reconcile-watermark";
import { logger } from "../logger";

/**
 * RECONCILE — profiles whose orders changed inside a watermark window. Usage
 *              writes recompute inline, so they are not watched here.
 * NIGHTLY   — every profile, paged. `ours` is a rolling 90-day window, so a
 *              clinic's value moves with the calendar even when nothing about it
 *              changed — and the watermark selects precisely those clinics never.
 * TRIGGER   — exactly the profiles named by the caller, one page, no paging.
 *
 * TRIGGER exists because a write to one order should recompute one profile.
 * Selection is the only difference: the recompute itself is the same pure
 * function of stored state, so a triggered run and a swept run of the same
 * (profile, metric) produce the same row (spec 0013 §4.4, §4.6).
 */
export type MetricSnapshotMode = "RECONCILE" | "NIGHTLY" | "TRIGGER";

export interface MetricSnapshotBatchInput {
  mode: MetricSnapshotMode;
  cursor: number | null;
  limit: number;
  /** RECONCILE only: the half-open watermark window. */
  since?: string;
  until?: string;
  /** TRIGGER only: the profiles to recompute. No query decides this. */
  profileIds?: number[];
}

export interface MetricSnapshotFailure {
  profileId: number | null;
  message: string;
}

export interface MetricSnapshotBatchResult {
  processed: number;
  /** Rows written, changed or not. */
  written: number;
  /** Rows whose value moved — on RECONCILE, evidence a trigger was lost. */
  differed: number;
  failed: number;
  nextCursor: number | null;
  failures: MetricSnapshotFailure[];
}

/**
 * Everything the batch needs from storage. Injected so the batching, failure
 * handling and reporting can be asserted without a database.
 */
export interface MetricSnapshotBatchStore {
  listChangedProfileIds(input: {
    since: Date;
    until: Date;
    afterProfileId: number;
    limit: number;
  }): Promise<number[]>;
  listAllProfileIds(input: { afterProfileId: number; limit: number }): Promise<number[]>;
  recompute(input: {
    profileId: number;
      computedAt: Date;
  }): Promise<{ written: number; differed: number }>;
}

export function createMetricSnapshotBatchStore(database: AnyDatabase): MetricSnapshotBatchStore {
  const store = createMetricSnapshotStore(database);
  return {
    listChangedProfileIds: (input) => listProfilesWithChangedInputs(database, input),
    listAllProfileIds: (input) => listAllProfileIds(database, input),
    recompute: (input) => recomputeMetricSnapshots(store, input),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createMetricSnapshotBatchActivity(dependencies: {
  store: MetricSnapshotBatchStore;
  now?: () => Date;
}) {
  return async function recalculateMetricSnapshotsBatch(
    input: MetricSnapshotBatchInput,
  ): Promise<MetricSnapshotBatchResult> {
    if (input.mode === "RECONCILE" && (!input.since || !input.until)) {
      const message = "RECONCILE requires since and until";
      logger.error("facility_metric_snapshot.batch_validation_failed", {
        mode: input.mode,
        cursor: input.cursor ?? undefined,
        message,
      });
      // Non-retryable: retrying a malformed input just burns attempts.
      throw ApplicationFailure.nonRetryable(message, "MetricSnapshotValidationFailure");
    }
    if (input.mode === "TRIGGER" && (input.profileIds?.length ?? 0) === 0) {
      const message = "TRIGGER requires at least one profileId";
      logger.error("facility_metric_snapshot.batch_validation_failed", {
        mode: input.mode,
        message,
      });
      // Non-retryable, and loud: a trigger that resolved no profile is a caller
      // bug, and recomputing nothing must never look like recomputing something.
      throw ApplicationFailure.nonRetryable(message, "MetricSnapshotValidationFailure");
    }
    const cursor = input.cursor ?? 0;
    let profileIds: number[];
    if (input.mode === "TRIGGER") {
      profileIds = input.profileIds ?? [];
    } else {
      try {
        profileIds =
          input.mode === "NIGHTLY"
            ? await dependencies.store.listAllProfileIds({ afterProfileId: cursor, limit: input.limit })
            : await dependencies.store.listChangedProfileIds({
                since: new Date(input.since!),
                until: new Date(input.until!),
                afterProfileId: cursor,
                limit: input.limit,
              });
      } catch (error) {
        const failure = { profileId: null, message: errorMessage(error) };
        logger.error("facility_metric_snapshot.page_selection_failed", {
          mode: input.mode,
          cursor: input.cursor ?? undefined,
          failure,
        });
        // Retryable: a page-selection failure is almost always transient, and
        // giving up would silently stop reconciling.
        throw ApplicationFailure.retryable(
          `Metric snapshot page selection failed: ${failure.message}`,
          "MetricSnapshotDatabaseFailure",
          [failure],
        );
      }
    }

    const computedAt = dependencies.now?.() ?? new Date();
    const failures: MetricSnapshotFailure[] = [];
    let written = 0;
    let differed = 0;

    for (const profileId of profileIds) {
      try {
        const result = await dependencies.store.recompute({
          profileId,
            computedAt,
        });
        written += result.written;
        differed += result.differed;
      } catch (error) {
        // One profile failing must not abandon the rest of the page — but it is
        // recorded and counted rather than swallowed, so a systematically broken
        // profile shows up instead of quietly never being recomputed.
        const failure = { profileId, message: errorMessage(error) };
        failures.push(failure);
        logger.error("facility_metric_snapshot.profile_failed", { mode: input.mode, ...failure });
      }
    }

    // TRIGGER has no page after this one: its profiles came from the caller, not
    // from a keyset scan, so continuing would re-read the same ids forever.
    const nextCursor =
      input.mode === "TRIGGER" || profileIds.length === 0
        ? null
        : profileIds[profileIds.length - 1]!;

    return {
      processed: profileIds.length,
      written,
      differed,
      failed: failures.length,
      nextCursor,
      failures,
    };
  };
}

export async function recalculateMetricSnapshotsBatch(
  input: MetricSnapshotBatchInput,
): Promise<MetricSnapshotBatchResult> {
  return createMetricSnapshotBatchActivity({
    store: createMetricSnapshotBatchStore(getDb()),
  })(input);
}

export interface MetricSnapshotWindowInput {
  until: string;
}

export interface MetricSnapshotWindowPlan {
  since: string;
}

/**
 * The window the hourly RECONCILE should cover.
 *
 * It was a fixed two-hour lookback from the run's own start, and the comment
 * beside it already called that a watermark. Under overlap `SKIP` it is not one:
 * a run that overruns causes the next firings to be skipped, and the run that
 * does fire looks back two hours from *itself*, so the hours in between are
 * covered by nobody. Unlike the purchase funnel there is no sweep to hide it —
 * the NIGHTLY pass visits every profile but recomputes from current state, so a
 * missed order change that has since aged out of the rolling 90-day window is
 * simply lost.
 *
 * No `fullSweep` in the plan: NIGHTLY is its own schedule and its own mode, so a
 * badly lagging watermark just yields a wide window, which the keyset paging
 * already handles.
 */
export function createClaimMetricSnapshotWindowActivity(dependencies: {
  read: () => Promise<string | null>;
}) {
  return async function claimMetricSnapshotWindow(
    input: MetricSnapshotWindowInput,
  ): Promise<MetricSnapshotWindowPlan> {
    let coveredUntil: string | null = null;
    try {
      coveredUntil = await dependencies.read();
    } catch (error) {
      throw ApplicationFailure.retryable(
        `Metric snapshot watermark read failed: ${errorMessage(error)}`,
        "MetricSnapshotDatabaseFailure",
      );
    }
    const { since } = planReconcileWindow({ coveredUntil, until: input.until });
    logger.info("facility_metric_snapshot.window_planned", {
      coveredUntil: coveredUntil ?? undefined,
      since,
      until: input.until,
    });
    return { since };
  };
}

export function createCommitMetricSnapshotWindowActivity(dependencies: {
  commit: (until: string) => Promise<void>;
}) {
  return async function commitMetricSnapshotWindow(
    input: MetricSnapshotWindowInput,
  ): Promise<void> {
    try {
      await dependencies.commit(input.until);
    } catch (error) {
      // Retryable on purpose: dropping the commit re-does the same window
      // forever, which is the failure the watermark exists to prevent.
      throw ApplicationFailure.retryable(
        `Metric snapshot watermark commit failed: ${errorMessage(error)}`,
        "MetricSnapshotDatabaseFailure",
      );
    }
    logger.info("facility_metric_snapshot.window_committed", { until: input.until });
  };
}

export const claimMetricSnapshotWindow = createClaimMetricSnapshotWindowActivity({
  read: () => readCoveredUntil(getDb(), RECONCILE_WATERMARKS.metricSnapshot),
});

export const commitMetricSnapshotWindow = createCommitMetricSnapshotWindowActivity({
  commit: (until) =>
    commitCoveredUntil(getDb(), RECONCILE_WATERMARKS.metricSnapshot, until),
});

export interface MetricSnapshotLifecycleLogInput {
  action: string;
  mode: MetricSnapshotMode;
  processed: number;
  written: number;
  differed: number;
  failed: number;
  durationMs: number;
}

/**
 * Emits the run's totals.
 *
 * `differed` is the reason this exists. A sweep that silently repairs a stale
 * snapshot fixes the number and hides the fault — spec 0013 §4.4 wants the lost
 * trigger reported, not just healed. A reconciliation run that keeps finding
 * differences is telling you the trigger is unreliable.
 */
export async function logMetricSnapshotLifecycle(
  input: MetricSnapshotLifecycleLogInput,
): Promise<void> {
  const level = input.failed > 0 ? "error" : "info";
  logger[level](input.action, {
    mode: input.mode,
    processed: input.processed,
    written: input.written,
    differed: input.differed,
    failed: input.failed,
    durationMs: input.durationMs,
  });
}

