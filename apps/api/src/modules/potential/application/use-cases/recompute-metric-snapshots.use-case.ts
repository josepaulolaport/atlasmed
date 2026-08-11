import {
  monthKeyAt,
  recomputeMetricSnapshots,
  trailingMonths,
  type MonthKey,
  type RecomputeMetricSnapshotsResult,
} from "@atlasmed/facility-insights";
import { createMetricSnapshotStore, type AnyDatabase } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";

/**
 * Recomputes `facility_metric_snapshots` for one profile.
 *
 * Both the algorithm and its queries live outside this module — the algorithm in
 * `@atlasmed/facility-insights`, the storage in `@atlasmed/database` — because
 * the Temporal worker runs the identical recompute for the reconciliation sweep
 * and cannot import from `apps/api`. This class is the API's entry point to
 * them, and deliberately holds no rules of its own: there is nothing here that
 * could drift from what the sweep does.
 *
 * The database is injectable so the behaviour can be asserted inside a
 * rolled-back transaction against real rows.
 */
export class RecomputeMetricSnapshotsUseCase {
  constructor(private readonly deps: { database?: AnyDatabase } = {}) {}

  async execute(input: {
    profileId: number;
    months: MonthKey[];
    computedAt?: Date;
  }): Promise<RecomputeMetricSnapshotsResult> {
    const store = createMetricSnapshotStore(this.deps.database ?? db);
    return recomputeMetricSnapshots(store, {
      profileId: input.profileId,
      months: input.months,
      computedAt: input.computedAt ?? new Date(),
    });
  }
}

/**
 * The window a write-triggered recompute covers.
 *
 * A single edit can only affect the month it belongs to — but the displayed
 * figure averages a trailing window, so the months either side are what a reader
 * actually sees move. Kept here so the trigger and the sweep agree on it.
 */
export function windowForInstant(instant: Date, monthsInWindow: number): MonthKey[] {
  return trailingMonths(monthKeyAt(instant), monthsInWindow);
}

export type { RecomputeMetricSnapshotsResult as RecomputeResult };
