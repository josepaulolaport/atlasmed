import { ApplicationFailure } from "@temporalio/activity";
import {
  createMetricSnapshotStore,
  listAllProfileIds,
  listProfilesWithChangedInputs,
  type AnyDatabase,
} from "@atlasmed/database";
import {
  monthKeyAt,
  recomputeMetricSnapshots,
  trailingMonths,
  type MonthKey,
} from "@atlasmed/facility-insights";
import { getDb } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * RECONCILE — profiles whose inputs changed inside a watermark window.
 * BACKFILL  — every profile, paged.
 * TRIGGER   — exactly the profiles named by the caller, one page, no paging.
 *
 * TRIGGER exists because a write to one order should recompute one profile.
 * Selection is the only difference: the recompute itself is the same pure
 * function of stored state, so a triggered run and a swept run of the same
 * (profile, month) produce the same row (spec 0013 §4.4).
 */
export type MetricSnapshotMode = "RECONCILE" | "BACKFILL" | "TRIGGER";

export interface MetricSnapshotBatchInput {
  mode: MetricSnapshotMode;
  cursor: number | null;
  limit: number;
  /** Months to recompute. Explicit — the activity decides nothing about which. */
  months: MonthKey[];
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
    months: MonthKey[];
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
    if (input.months.length === 0) {
      throw ApplicationFailure.nonRetryable(
        "months must not be empty",
        "MetricSnapshotValidationFailure",
      );
    }

    const cursor = input.cursor ?? 0;
    let profileIds: number[];
    if (input.mode === "TRIGGER") {
      profileIds = input.profileIds ?? [];
    } else {
      try {
        profileIds =
          input.mode === "BACKFILL"
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
          months: input.months,
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

export interface MetricSnapshotLifecycleLogInput {
  action: string;
  mode: MetricSnapshotMode;
  months: MonthKey[];
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
    // The logger takes scalars, and the window is more useful as its bounds than
    // as a list — three entries today, but the constant is a deploy away.
    monthsFrom: input.months[0],
    monthsTo: input.months[input.months.length - 1],
    monthCount: input.months.length,
    processed: input.processed,
    written: input.written,
    differed: input.differed,
    failed: input.failed,
    durationMs: input.durationMs,
  });
}

/** The trailing window a run covers, ending at `instant`'s month. */
export function windowMonths(instant: Date, monthsInWindow: number): MonthKey[] {
  return trailingMonths(monthKeyAt(instant), monthsInWindow);
}
