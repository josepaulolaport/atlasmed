import { monthBounds, type MonthKey } from "./market-metric";

/**
 * Recomputing `facility_metric_snapshots` for one profile (spec 0013 §4.4).
 *
 * **Why this lives in a package rather than in the API module.** The Temporal
 * worker cannot import from `apps/api` — it depends only on packages — so a
 * sweep implemented in the worker would need its own copy of this algorithm.
 * Two copies of a business rule is how they drift; `search/rebuild.ts` already
 * carries a "Keep in sync with apps/api" comment, which is that failure mode
 * already in progress. The algorithm lives here once and both callers supply a
 * store.
 *
 * The function is a **pure function of stored state**: it reads through the
 * port, computes, and writes each row whole — never a delta. Run it once or
 * fifty times, concurrently or out of order, and the result is identical. That
 * is what makes at-least-once delivery acceptable and what lets the whole table
 * be truncated and rebuilt.
 */

export type ProfileForSnapshot = {
  id: number;
  facilityId: number;
  verticalId: number;
};

export type OursByDefinitionMonth = {
  definitionId: number;
  month: MonthKey;
  totalQty: number;
};

export type StoredSnapshotCell = {
  definitionId: number;
  month: MonthKey;
  oursQty: number;
  theirsQty: number;
};

export type SnapshotRowToWrite = {
  profileId: number;
  definitionId: number;
  verticalId: number;
  month: MonthKey;
  oursQty: number;
  theirsQty: number;
  computedAt: Date;
};

/**
 * Everything the recompute needs from storage, and nothing else.
 *
 * Deliberately narrow: the API's repository and the worker's drizzle queries are
 * different objects with different lifetimes, and neither should have to satisfy
 * an interface shaped by the other's convenience.
 */
export interface MetricSnapshotStore {
  findProfile(profileId: number): Promise<ProfileForSnapshot | null>;
  listDefinitionIds(input: { verticalId: number }): Promise<number[]>;
  sumOurs(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<OursByDefinitionMonth[]>;
  /**
   * Every recorded competitor figure for these definitions, with the month it
   * was recorded under. The caller reduces it to what stood at a given month.
   */
  listTheirsHistory(input: {
    profileId: number;
    definitionIds: number[];
  }): Promise<
    Array<{
      definitionId: number;
      productId: number;
      month: MonthKey;
      metricQuantity: number;
    }>
  >;

  listExisting(input: {
    profileId: number;
    months: MonthKey[];
  }): Promise<StoredSnapshotCell[]>;
  upsert(rows: SnapshotRowToWrite[]): Promise<void>;
}

export type RecomputeMetricSnapshotsResult = {
  profileId: number;
  /** Rows written, changed or not. */
  written: number;
  /** Rows whose value actually moved — a lost trigger's fingerprint. */
  differed: number;
  months: MonthKey[];
};

export async function recomputeMetricSnapshots(
  store: MetricSnapshotStore,
  input: {
    profileId: number;
    /** Explicit months. The caller decides the window; this decides nothing. */
    months: MonthKey[];
    computedAt: Date;
  },
): Promise<RecomputeMetricSnapshotsResult> {
  if (input.months.length === 0) {
    return { profileId: input.profileId, written: 0, differed: 0, months: [] };
  }

  const profile = await store.findProfile(input.profileId);
  if (!profile) {
    // Not an error: a profile can be deleted between a trigger being enqueued
    // and the handler running. There is simply nothing left to compute.
    return { profileId: input.profileId, written: 0, differed: 0, months: [] };
  }

  const months = [...new Set(input.months)].sort();
  const definitionIds = await store.listDefinitionIds({ verticalId: profile.verticalId });
  if (definitionIds.length === 0) {
    return { profileId: profile.id, written: 0, differed: 0, months };
  }

  // One range spanning every requested month, then bucketed in memory — the
  // alternative is a query per month, and the months are contiguous in every
  // caller we have.
  const rangeStart = monthBounds(months[0]!).start;
  const rangeEnd = monthBounds(months[months.length - 1]!).end;

  const [oursRows, theirsRows, existing] = await Promise.all([
    store.sumOurs({
      facilityId: profile.facilityId,
      verticalId: profile.verticalId,
      definitionIds,
      rangeStart,
      rangeEnd,
    }),
    store.listTheirsHistory({ profileId: profile.id, definitionIds }),
    store.listExisting({ profileId: profile.id, months }),
  ]);

  const requested = new Set(months);
  const ours = new Map<string, number>();
  for (const row of oursRows) {
    if (!requested.has(row.month)) continue;
    const key = cellKey(row.definitionId, row.month);
    ours.set(key, (ours.get(key) ?? 0) + row.totalQty);
  }

  // What each competitor product *stood at* during month M — its newest record
  // on or before M — not the rows filed under M.
  //
  // A rep answers "quantas por mês" once and the figure holds until they replace
  // it, so a month with no new record is not a month with no competitor. Reading
  // rows filed under M made July report zero for a product recorded in June, and
  // `theirs = 0` with `ours > 0` is a 100% share asserted on no evidence — the
  // "confident, wrong number" §4.4 refuses when it forbids backfilling.
  const theirs = new Map<string, number>();
  for (const month of months) {
    const standing = new Map<string, { month: MonthKey; metricQuantity: number }>();
    for (const row of theirsRows) {
      if (row.month > month) continue;
      const productKey = `${row.definitionId}:${row.productId}`;
      const held = standing.get(productKey);
      if (held === undefined || row.month > held.month) {
        standing.set(productKey, { month: row.month, metricQuantity: row.metricQuantity });
      }
    }
    for (const [productKey, held] of standing) {
      const definitionId = Number(productKey.split(":")[0]);
      const key = cellKey(definitionId, month);
      theirs.set(key, (theirs.get(key) ?? 0) + held.metricQuantity);
    }
  }

  const stored = new Map<string, { oursQty: number; theirsQty: number }>();
  for (const row of existing) {
    if (!requested.has(row.month)) continue;
    stored.set(cellKey(row.definitionId, row.month), {
      oursQty: row.oursQty,
      theirsQty: row.theirsQty,
    });
  }

  // Every cell with an input *or* an existing row. The second half is what
  // corrects a row whose inputs have since vanished — an order deleted, a usage
  // row removed. Recomputing only the cells that still have inputs would leave
  // yesterday's figure standing and report success.
  const cells = new Set<string>([...ours.keys(), ...theirs.keys(), ...stored.keys()]);

  const rows: SnapshotRowToWrite[] = [];
  // Counts rows whose *value* moved, not rows touched. A nonzero count on a
  // reconciliation run means the stored figure was stale — a trigger was lost.
  // Reporting it is the difference between a sweep that heals silently and one
  // that tells you the trigger is unreliable.
  let differed = 0;
  for (const cell of cells) {
    const { definitionId, month } = parseCellKey(cell);
    const oursQty = ours.get(cell) ?? 0;
    const theirsQty = theirs.get(cell) ?? 0;
    const before = stored.get(cell);
    if (!before || before.oursQty !== oursQty || before.theirsQty !== theirsQty) {
      differed += 1;
    }
    rows.push({
      profileId: profile.id,
      definitionId,
      verticalId: profile.verticalId,
      month,
      oursQty,
      theirsQty,
      computedAt: input.computedAt,
    });
  }

  await store.upsert(rows);

  return { profileId: profile.id, written: rows.length, differed, months };
}

function cellKey(definitionId: number, month: MonthKey): string {
  return `${definitionId}|${month}`;
}

function parseCellKey(key: string): { definitionId: number; month: MonthKey } {
  const [definitionId, month] = key.split("|");
  return { definitionId: Number(definitionId), month: month! };
}
