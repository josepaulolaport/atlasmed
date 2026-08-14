import { describe, expect, it } from "bun:test";
import { recomputeMetricSnapshots } from "./metric-snapshot";
import type {
  MetricSnapshotStore,
  SnapshotRowToWrite,
  StoredSnapshotCell,
  TheirsByProduct,
} from "./metric-snapshot";

/**
 * One row per (clinic-linha, metric), saying what is true now (spec 0013 §4.6).
 *
 * Note what the store interface does not expose: the `no_other_brands` claim.
 * It shares a row with these figures but it is a rep's assertion, not a derived
 * value, so the algorithm has no way to read or write it — the guarantee is
 * structural rather than a rule someone has to remember.
 */
function createStore(options: {
  ours?: Array<{ definitionId: number; totalQty: number }>;
  theirs?: TheirsByProduct[];
  existing?: StoredSnapshotCell[];
  written?: SnapshotRowToWrite[];
  definitionIds?: number[];
  windows?: Array<{ start: Date; end: Date }>;
}): MetricSnapshotStore {
  return {
    findProfile: async () => ({ id: 1, facilityId: 10, verticalId: 5 }),
    listDefinitionIds: async () => options.definitionIds ?? [7],
    sumOurs: async (input) => {
      options.windows?.push({ start: input.rangeStart, end: input.rangeEnd });
      return options.ours ?? [];
    },
    listTheirs: async () => options.theirs ?? [],
    listExisting: async () => options.existing ?? [],
    upsert: async (rows) => {
      options.written?.push(...rows);
    },
  };
}

const NOW = new Date("2026-08-15T12:00:00.000Z");

function theirs(productId: number, quantity: number): TheirsByProduct {
  return {
    definitionId: 7,
    productId,
    productName: `Marca ${productId}`,
    quantity,
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  };
}

async function recompute(options: Parameters<typeof createStore>[0] = {}) {
  const written: SnapshotRowToWrite[] = [];
  const result = await recomputeMetricSnapshots(
    createStore({ ...options, written }),
    { profileId: 1, computedAt: NOW },
  );
  return { written, result };
}

describe("what a metric snapshot holds", () => {
  it("writes one row per metric, with no month", async () => {
    const { written } = await recompute({
      ours: [{ definitionId: 7, totalQty: 900 }],
      theirs: [theirs(100, 40)],
    });

    expect(written).toHaveLength(1);
    expect(written[0]).not.toHaveProperty("month");
    expect(written[0]!.definitionId).toBe(7);
  });

  it("normalises our 90-day window to a month", async () => {
    // 900 over 90 days is 300 a month. The window is what makes the value move
    // with the calendar, which is why a nightly pass exists.
    const { written } = await recompute({ ours: [{ definitionId: 7, totalQty: 900 }] });

    expect(written[0]!.oursQty).toBeCloseTo(300, 6);
  });

  it("measures that window from the instant it was given, not the wall clock", async () => {
    const windows: Array<{ start: Date; end: Date }> = [];
    await recompute({ windows });

    expect(windows).toHaveLength(1);
    expect(windows[0]!.end).toEqual(NOW);
    const days = (windows[0]!.end.getTime() - windows[0]!.start.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(90, 6);
  });

  it("sums the standing figure of every competitor product", async () => {
    // Each is already a monthly rate; different products add.
    const { written } = await recompute({ theirs: [theirs(100, 40), theirs(200, 25)] });

    expect(written[0]!.theirsQty).toBe(65);
  });

  it("reports theirs as zero when no competitor product is recorded", async () => {
    // Zero here means "nothing recorded". Whether that is a known-empty market
    // or an unsurveyed one is the `no_other_brands` claim's job, and the share
    // that depends on it is computed by the database, not here.
    const { written } = await recompute({ ours: [{ definitionId: 7, totalQty: 900 }] });

    expect(written[0]!.theirsQty).toBe(0);
  });

  it("corrects a metric whose inputs have all disappeared", async () => {
    // The order was deleted, or the last competitor removed. Recomputing only
    // metrics that still have inputs would leave yesterday's figure standing
    // and report success.
    const { written, result } = await recompute({
      existing: [{ definitionId: 7, oursQty: 300, theirsQty: 40 }],
    });

    expect(written).toHaveLength(1);
    expect(written[0]!.oursQty).toBe(0);
    expect(written[0]!.theirsQty).toBe(0);
    expect(result.differed).toBe(1);
  });

  it("counts a row as differed only when its value moved", async () => {
    // `differed` is a lost trigger's fingerprint, so an unchanged recompute must
    // report zero — otherwise the signal is noise.
    const { result } = await recompute({
      ours: [{ definitionId: 7, totalQty: 900 }],
      theirs: [theirs(100, 40)],
      existing: [{ definitionId: 7, oursQty: 300, theirsQty: 40 }],
    });

    expect(result.written).toBe(1);
    expect(result.differed).toBe(0);
  });

  it("writes a row for every metric that has an input or a stored row", async () => {
    // 7 has an order, 8 only a stored row whose inputs have gone. Both are
    // written; a metric with neither is not invented.
    const { written } = await recompute({
      definitionIds: [7, 8, 9],
      ours: [{ definitionId: 7, totalQty: 900 }],
      existing: [{ definitionId: 8, oursQty: 10, theirsQty: 0 }],
    });

    expect(written.map((row) => row.definitionId).sort()).toEqual([7, 8]);
  });

  it("does nothing for a profile that has gone", async () => {
    const store = createStore({});
    const result = await recomputeMetricSnapshots(
      { ...store, findProfile: async () => null },
      { profileId: 1, computedAt: NOW },
    );

    expect(result).toEqual({ profileId: 1, written: 0, differed: 0 });
  });
});
