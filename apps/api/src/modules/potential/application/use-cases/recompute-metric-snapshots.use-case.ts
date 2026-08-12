import {
  recomputeMetricSnapshots,
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
    computedAt?: Date;
  }): Promise<RecomputeMetricSnapshotsResult> {
    const store = createMetricSnapshotStore(this.deps.database ?? db);
    return recomputeMetricSnapshots(store, {
      profileId: input.profileId,
      computedAt: input.computedAt ?? new Date(),
    });
  }
}

export type { RecomputeMetricSnapshotsResult as RecomputeResult };
