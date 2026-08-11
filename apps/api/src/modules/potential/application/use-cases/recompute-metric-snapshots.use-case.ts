import {
  monthKeyAt,
  recomputeMetricSnapshots,
  trailingMonths,
  type MetricSnapshotStore,
  type MonthKey,
  type RecomputeMetricSnapshotsResult,
} from "@atlasmed/facility-insights";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";

/**
 * Recomputes `facility_metric_snapshots` for one profile.
 *
 * The algorithm itself lives in `@atlasmed/facility-insights` because the
 * Temporal worker cannot import from `apps/api` and needs the identical
 * behaviour for the reconciliation sweep. This class is the adapter that lets
 * the API's repository satisfy that port — it holds no rules of its own, so
 * there is nothing here to drift from what the sweep does.
 */
export class RecomputeMetricSnapshotsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    profileId: number;
    months: MonthKey[];
    computedAt?: Date;
  }): Promise<RecomputeMetricSnapshotsResult> {
    return recomputeMetricSnapshots(toStore(this.deps.potentialRepository), {
      profileId: input.profileId,
      months: input.months,
      computedAt: input.computedAt ?? new Date(),
    });
  }
}

function toStore(repository: PotentialRepository): MetricSnapshotStore {
  return {
    findProfile: (profileId) => repository.findProfileById(profileId),
    listDefinitionIds: async ({ verticalId }) => {
      const definitions = await repository.listDefinitions({ verticalId });
      return definitions.map((definition) => definition.id);
    },
    sumOurs: (query) => repository.sumAtlasmedQtyByDefinitionAndMonth(query),
    sumTheirs: async (query) => {
      const usage = await repository.listUsage(query);
      return usage.map((row) => ({
        definitionId: row.definitionId,
        month: row.month,
        metricQuantity: row.metricQuantity,
      }));
    },
    listExisting: (query) => repository.listMetricSnapshotValues(query),
    upsert: (rows) => repository.upsertMetricSnapshots(rows),
  };
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
