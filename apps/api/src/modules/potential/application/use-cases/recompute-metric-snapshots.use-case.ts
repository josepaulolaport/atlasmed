import {
  monthBounds,
  monthKeyAt,
  trailingMonths,
  type MonthKey,
} from "@atlasmed/facility-insights";
import type {
  MetricSnapshotWrite,
  PotentialRepository,
} from "../interfaces/potential.repository.interface";

/**
 * Recomputes `facility_metric_snapshots` for one profile over an explicit set of
 * months (spec 0013 §4.4).
 *
 * **A pure function of stored state.** For each (definition, month) it reads the
 * orders and usage rows and writes that row whole — never a delta, never an
 * increment. Run once or fifty times, concurrently or out of order, the result
 * is identical. That is what makes at-least-once delivery acceptable and what
 * lets the table be truncated and rebuilt.
 *
 * The clock is an argument, not an ambient fact. Nothing here reads `Date.now()`
 * except to default `computedAt`, so recomputing March next year produces
 * exactly today's answer for March.
 */
export class RecomputeMetricSnapshotsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    profileId: number;
    /** Explicit months. The caller decides the window; this decides nothing. */
    months: MonthKey[];
    computedAt?: Date;
  }): Promise<RecomputeResult> {
    if (input.months.length === 0) {
      return { profileId: input.profileId, written: 0, months: [] };
    }

    const profile = await this.deps.potentialRepository.findProfileById(input.profileId);
    if (!profile) {
      // Not an error: a profile can be deleted between a trigger being enqueued
      // and the handler running. There is simply nothing left to compute.
      return { profileId: input.profileId, written: 0, months: [] };
    }

    const months = [...new Set(input.months)].sort();
    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: profile.verticalId,
    });
    const definitionIds = definitions.map((definition) => definition.id);
    if (definitionIds.length === 0) {
      return { profileId: input.profileId, written: 0, months };
    }

    // One range spanning every requested month, then bucketed in memory — the
    // alternative is a query per month, and the months are contiguous in every
    // caller we have.
    const rangeStart = monthBounds(months[0]!).start;
    const rangeEnd = monthBounds(months[months.length - 1]!).end;

    const [qtySums, usage, existingKeys] = await Promise.all([
      this.deps.potentialRepository.sumAtlasmedQtyByDefinitionAndMonth({
        facilityId: profile.facilityId,
        verticalId: profile.verticalId,
        definitionIds,
        rangeStart,
        rangeEnd,
      }),
      this.deps.potentialRepository.listUsage({
        profileId: profile.id,
        definitionIds,
        months,
      }),
      this.deps.potentialRepository.listMetricSnapshotKeys({
        profileId: profile.id,
        months,
      }),
    ]);

    const requested = new Set(months);
    const ours = new Map<string, number>();
    for (const row of qtySums) {
      if (!requested.has(row.month)) continue;
      const key = cellKey(row.definitionId, row.month);
      ours.set(key, (ours.get(key) ?? 0) + row.totalQty);
    }

    const theirs = new Map<string, number>();
    for (const row of usage) {
      const key = cellKey(row.definitionId, row.month);
      theirs.set(key, (theirs.get(key) ?? 0) + row.metricQuantity);
    }

    // Write a row for every cell that has an input *or* already has a snapshot.
    // The second half is what corrects a row whose inputs have since vanished —
    // an order deleted, a usage row removed. Recomputing only the cells that
    // still have inputs would leave yesterday's figure standing and report
    // success.
    const cells = new Set<string>([...ours.keys(), ...theirs.keys()]);
    for (const key of existingKeys) {
      if (requested.has(key.month)) cells.add(cellKey(key.definitionId, key.month));
    }

    const computedAt = input.computedAt ?? new Date();
    const rows: MetricSnapshotWrite[] = [];
    for (const cell of cells) {
      const { definitionId, month } = parseCellKey(cell);
      rows.push({
        profileId: profile.id,
        definitionId,
        verticalId: profile.verticalId,
        month,
        oursQty: ours.get(cell) ?? 0,
        theirsQty: theirs.get(cell) ?? 0,
        computedAt,
      });
    }

    await this.deps.potentialRepository.upsertMetricSnapshots(rows);

    return { profileId: profile.id, written: rows.length, months };
  }
}

export type RecomputeResult = {
  profileId: number;
  written: number;
  months: MonthKey[];
};

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

function cellKey(definitionId: number, month: MonthKey): string {
  return `${definitionId}|${month}`;
}

function parseCellKey(key: string): { definitionId: number; month: MonthKey } {
  const [definitionId, month] = key.split("|");
  return { definitionId: Number(definitionId), month: month! };
}
