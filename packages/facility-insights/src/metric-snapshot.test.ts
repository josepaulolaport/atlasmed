import { describe, expect, it } from "bun:test";
import { recomputeMetricSnapshots } from "./metric-snapshot";
import type { MetricSnapshotStore, SnapshotRowToWrite } from "./metric-snapshot";
import type { MonthKey } from "./market-metric";

/**
 * What a snapshot says a competitor was worth in a given month.
 *
 * A rep answers "quantas por mês" once and that figure holds until they replace
 * it. Reading only the rows filed under month M therefore reports zero for every
 * month after the one they happened to record in — and `theirs = 0` beside
 * `ours > 0` is a 100% share asserted on no evidence, which is the
 * "confident, wrong number" spec 0013 §4.4 refuses.
 */
function createStore(options: {
  theirs?: Array<{
    definitionId: number;
    productId: number;
    month: MonthKey;
    metricQuantity: number;
  }>;
  ours?: Array<{ definitionId: number; month: MonthKey; totalQty: number }>;
  written?: SnapshotRowToWrite[];
}): MetricSnapshotStore {
  return {
    findProfile: async () => ({ id: 1, facilityId: 10, verticalId: 5 }),
    listDefinitionIds: async () => [7],
    sumOurs: async () => options.ours ?? [],
    listTheirsHistory: async () => options.theirs ?? [],
    listExisting: async () => [],
    upsert: async (rows) => {
      options.written?.push(...rows);
    },
  };
}

const MONTHS: MonthKey[] = ["2026-06-01", "2026-07-01", "2026-08-01"];

async function snapshotFor(options: Parameters<typeof createStore>[0]) {
  const written: SnapshotRowToWrite[] = [];
  await recomputeMetricSnapshots(createStore({ ...options, written }), {
    profileId: 1,
    months: MONTHS,
    computedAt: new Date("2026-08-15T12:00:00.000Z"),
  });
  return written;
}

describe("what a snapshot says a competitor was worth", () => {
  it("carries a figure forward into the months after it was recorded", async () => {
    // Recorded once in June. July and August had no new record — that is not the
    // same as the competitor having gone away.
    const written = await snapshotFor({
      theirs: [
        { definitionId: 7, productId: 100, month: "2026-06-01", metricQuantity: 100 },
      ],
      ours: MONTHS.map((month) => ({ definitionId: 7, month, totalQty: 50 })),
    });

    const byMonth = new Map(written.map((row) => [row.month, row.theirsQty]));
    expect(byMonth.get("2026-06-01")).toBe(100);
    expect(byMonth.get("2026-07-01")).toBe(100);
    expect(byMonth.get("2026-08-01")).toBe(100);
  });

  it("does not report a 100% share for the months with no new record", async () => {
    const written = await snapshotFor({
      theirs: [
        { definitionId: 7, productId: 100, month: "2026-06-01", metricQuantity: 100 },
      ],
      ours: MONTHS.map((month) => ({ definitionId: 7, month, totalQty: 50 })),
    });

    for (const row of written) {
      expect(row.oursQty / (row.oursQty + row.theirsQty)).toBeCloseTo(1 / 3, 6);
    }
  });

  it("takes the newest figure on or before the month, not the newest overall", async () => {
    // Corrected downward in August. June must still read 100 — the correction
    // was not in force yet — and August must read 40.
    const written = await snapshotFor({
      theirs: [
        { definitionId: 7, productId: 100, month: "2026-06-01", metricQuantity: 100 },
        { definitionId: 7, productId: 100, month: "2026-08-01", metricQuantity: 40 },
      ],
    });

    const byMonth = new Map(written.map((row) => [row.month, row.theirsQty]));
    expect(byMonth.get("2026-06-01")).toBe(100);
    expect(byMonth.get("2026-07-01")).toBe(100);
    expect(byMonth.get("2026-08-01")).toBe(40);
  });

  it("adds the standing figures of different products", async () => {
    const written = await snapshotFor({
      theirs: [
        { definitionId: 7, productId: 100, month: "2026-06-01", metricQuantity: 100 },
        { definitionId: 7, productId: 200, month: "2026-07-01", metricQuantity: 25 },
      ],
    });

    const byMonth = new Map(written.map((row) => [row.month, row.theirsQty]));
    expect(byMonth.get("2026-06-01")).toBe(100);
    // The second product joins the month it was recorded in, not before it.
    expect(byMonth.get("2026-07-01")).toBe(125);
    expect(byMonth.get("2026-08-01")).toBe(125);
  });

  it("reports nothing for months before any competitor was ever recorded", async () => {
    // Absence here is genuine: nobody had surveyed this clinic yet. The share
    // rule that keeps 0 and unknown apart lives in the read, not here.
    const written = await snapshotFor({
      theirs: [
        { definitionId: 7, productId: 100, month: "2026-08-01", metricQuantity: 100 },
      ],
      ours: MONTHS.map((month) => ({ definitionId: 7, month, totalQty: 50 })),
    });

    const byMonth = new Map(written.map((row) => [row.month, row.theirsQty]));
    expect(byMonth.get("2026-06-01")).toBe(0);
    expect(byMonth.get("2026-07-01")).toBe(0);
    expect(byMonth.get("2026-08-01")).toBe(100);
  });
});
