import { monthlyRateFromDays, rollingWindow } from "./market-metric";

/**
 * Recomputing `facility_metric_snapshots` for one profile (spec 0013 §4.4, §4.6).
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
 *
 * **One row per (profile, metric)** since §4.6. There are no months: the metric
 * says what is true now. `ours` is a rolling 90-day window, which is why the
 * value moves with the calendar and not only with events — see the nightly pass.
 */

export type ProfileForSnapshot = {
  id: number;
  facilityId: number;
  verticalId: number;
};

export type OursByDefinition = {
  definitionId: number;
  totalQty: number;
};

/** One competitor product's standing figure at a clinic. */
export type TheirsByProduct = {
  definitionId: number;
  productId: number;
  productName: string;
  quantity: number;
  updatedAt: Date;
};

export type StoredSnapshotCell = {
  definitionId: number;
  oursQty: number;
  theirsQty: number;
};

export type SnapshotRowToWrite = {
  profileId: number;
  definitionId: number;
  verticalId: number;
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
 *
 * Note what is absent — the `no_other_brands` claim. It shares a row with the
 * derived figures but it is an input, and this algorithm neither reads nor
 * writes it. The share that depends on it is computed by the database.
 */
export interface MetricSnapshotStore {
  findProfile(profileId: number): Promise<ProfileForSnapshot | null>;
  listDefinitionIds(input: { verticalId: number }): Promise<number[]>;
  /** Eligible order quantities over a date range, summed per metric. */
  sumOurs(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<OursByDefinition[]>;
  /**
   * The figure standing for each competitor product, for products still linked
   * to the metric. One row per product — a rep answers once and replaces.
   */
  listTheirs(input: {
    profileId: number;
    definitionIds: number[];
  }): Promise<TheirsByProduct[]>;
  listExisting(input: { profileId: number }): Promise<StoredSnapshotCell[]>;
  upsert(rows: SnapshotRowToWrite[]): Promise<void>;
}

export type RecomputeMetricSnapshotsResult = {
  profileId: number;
  /** Rows written, changed or not. */
  written: number;
  /** Rows whose value actually moved — a lost trigger's fingerprint. */
  differed: number;
};

export async function recomputeMetricSnapshots(
  store: MetricSnapshotStore,
  input: {
    profileId: number;
    /**
     * The instant the window is measured from. Injectable so a recompute is a
     * function of its arguments and not of when it happened to run.
     */
    computedAt: Date;
  },
): Promise<RecomputeMetricSnapshotsResult> {
  const profile = await store.findProfile(input.profileId);
  if (!profile) {
    // Not an error: a profile can be deleted between a trigger being enqueued
    // and the handler running. There is simply nothing left to compute.
    return { profileId: input.profileId, written: 0, differed: 0 };
  }

  const definitionIds = await store.listDefinitionIds({ verticalId: profile.verticalId });
  if (definitionIds.length === 0) {
    return { profileId: profile.id, written: 0, differed: 0 };
  }

  const window = rollingWindow(input.computedAt);

  const [oursRows, theirsRows, existing] = await Promise.all([
    store.sumOurs({
      facilityId: profile.facilityId,
      verticalId: profile.verticalId,
      definitionIds,
      rangeStart: window.start,
      rangeEnd: window.end,
    }),
    store.listTheirs({ profileId: profile.id, definitionIds }),
    store.listExisting({ profileId: profile.id }),
  ]);

  // Ours: a quantity observed over the window, normalised to a month. Raw
  // quantities — `metric_units` is an information field since §4.6.
  const ours = new Map<number, number>();
  for (const row of oursRows) {
    ours.set(row.definitionId, (ours.get(row.definitionId) ?? 0) + row.totalQty);
  }

  // Theirs: the sum of what stands recorded per product. Not an average over
  // anything — the rep answers "quantas por mês", so each figure is already a
  // monthly rate and holds until they replace it.
  const theirs = new Map<number, number>();
  for (const row of theirsRows) {
    theirs.set(row.definitionId, (theirs.get(row.definitionId) ?? 0) + row.quantity);
  }

  const stored = new Map<number, StoredSnapshotCell>();
  for (const row of existing) {
    stored.set(row.definitionId, row);
  }

  // Every metric with an input *or* an existing row. The second half is what
  // corrects a row whose inputs have since vanished — an order deleted, a usage
  // row removed. Recomputing only the metrics that still have inputs would leave
  // yesterday's figure standing and report success.
  const definitions = new Set<number>([
    ...ours.keys(),
    ...theirs.keys(),
    ...stored.keys(),
  ]);

  const rows: SnapshotRowToWrite[] = [];
  let differed = 0;

  for (const definitionId of definitions) {
    const oursQty = monthlyRateFromDays(ours.get(definitionId) ?? 0);
    const theirsQty = theirs.get(definitionId) ?? 0;

    const before = stored.get(definitionId);
    if (
      before === undefined ||
      !nearlyEqual(before.oursQty, oursQty) ||
      !nearlyEqual(before.theirsQty, theirsQty)
    ) {
      differed += 1;
    }

    rows.push({
      profileId: profile.id,
      definitionId,
      verticalId: profile.verticalId,
      oursQty,
      theirsQty,
      computedAt: input.computedAt,
    });
  }

  await store.upsert(rows);

  return { profileId: profile.id, written: rows.length, differed };
}

/**
 * Both sides are stored as `numeric(14,2)`, so comparing them exactly would
 * report a difference for every re-read of an unchanged row.
 */
function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}
