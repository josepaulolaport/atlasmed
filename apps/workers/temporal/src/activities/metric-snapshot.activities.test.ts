import { describe, expect, test } from "bun:test";
import {
  createMetricSnapshotBatchActivity,
  type MetricSnapshotBatchStore,
} from "./metric-snapshot.activities";

/**
 * The sweep's batching, failure handling and reporting (spec 0013 §4.4).
 *
 * The store is faked here on purpose: what these assert is the *batch* contract
 * — which candidate query each mode uses, that one bad profile does not abandon
 * the page, and that `differed` survives to the caller. The recompute itself is
 * asserted against a real Postgres in the API's database tests, because a claim
 * about stored rows can only be proved against storage.
 */

function createStore(overrides: Partial<MetricSnapshotBatchStore> = {}): MetricSnapshotBatchStore {
  return {
    listChangedProfileIds: async () => [],
    listAllProfileIds: async () => [],
    recompute: async () => ({ written: 0, differed: 0 }),
    ...overrides,
  };
}

const MONTHS = ["2026-01-01", "2026-02-01", "2026-03-01"];

describe("recalculateMetricSnapshotsBatch", () => {
  test("RECONCILE reads the watermark query, never the full list", async () => {
    let usedFullList = false;
    let windowSeen: { since: Date; until: Date } | null = null;

    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listAllProfileIds: async () => {
          usedFullList = true;
          return [];
        },
        listChangedProfileIds: async ({ since, until }) => {
          windowSeen = { since, until };
          return [7];
        },
      }),
    });

    await activity({
      mode: "RECONCILE",
      cursor: null,
      limit: 500,
      months: MONTHS,
      since: "2026-03-01T00:00:00.000Z",
      until: "2026-03-01T02:00:00.000Z",
    });

    expect(usedFullList).toBe(false);
    expect(windowSeen!.since.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(windowSeen!.until.toISOString()).toBe("2026-03-01T02:00:00.000Z");
  });

  test("BACKFILL reads every profile, never the watermark query", async () => {
    let usedWatermark = false;
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listChangedProfileIds: async () => {
          usedWatermark = true;
          return [];
        },
        listAllProfileIds: async () => [1, 2],
      }),
    });

    const result = await activity({
      mode: "BACKFILL",
      cursor: null,
      limit: 500,
      months: MONTHS,
    });

    expect(usedWatermark).toBe(false);
    expect(result.processed).toBe(2);
  });

  test("RECONCILE without a window fails without retrying", async () => {
    const activity = createMetricSnapshotBatchActivity({ store: createStore() });
    // Retrying a malformed input just burns attempts, so this must be
    // non-retryable rather than merely thrown.
    await expect(
      activity({ mode: "RECONCILE", cursor: null, limit: 500, months: MONTHS }),
    ).rejects.toMatchObject({ nonRetryable: true });
  });

  test("an empty month list is refused rather than silently doing nothing", async () => {
    const activity = createMetricSnapshotBatchActivity({ store: createStore() });
    await expect(
      activity({ mode: "BACKFILL", cursor: null, limit: 500, months: [] }),
    ).rejects.toMatchObject({ nonRetryable: true });
  });

  test("one failing profile does not abandon the rest of the page", async () => {
    const recomputed: number[] = [];
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listAllProfileIds: async () => [1, 2, 3],
        recompute: async ({ profileId }) => {
          if (profileId === 2) throw new Error("boom");
          recomputed.push(profileId);
          return { written: 1, differed: 1 };
        },
      }),
    });

    const result = await activity({
      mode: "BACKFILL",
      cursor: null,
      limit: 500,
      months: MONTHS,
    });

    expect(recomputed).toEqual([1, 3]);
    expect(result.processed).toBe(3);
    expect(result.failed).toBe(1);
    // Recorded, not swallowed: a systematically broken profile has to be
    // visible, otherwise it is simply never recomputed and nothing says so.
    expect(result.failures).toEqual([{ profileId: 2, message: "boom" }]);
  });

  test("totals and the differed count survive to the caller", async () => {
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listAllProfileIds: async () => [1, 2],
        recompute: async ({ profileId }) => ({
          written: 3,
          differed: profileId === 1 ? 2 : 0,
        }),
      }),
    });

    const result = await activity({
      mode: "BACKFILL",
      cursor: null,
      limit: 500,
      months: MONTHS,
    });

    expect(result.written).toBe(6);
    expect(result.differed).toBe(2);
    expect(result.failed).toBe(0);
  });

  test("the cursor advances to the last profile of the page", async () => {
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({ listAllProfileIds: async () => [4, 9, 11] }),
    });
    const result = await activity({
      mode: "BACKFILL",
      cursor: null,
      limit: 500,
      months: MONTHS,
    });
    expect(result.nextCursor).toBe(11);
  });

  test("an empty page ends the run rather than looping forever", async () => {
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({ listAllProfileIds: async () => [] }),
    });
    const result = await activity({
      mode: "BACKFILL",
      cursor: 40,
      limit: 500,
      months: MONTHS,
    });
    expect(result.processed).toBe(0);
    expect(result.nextCursor).toBeNull();
  });

  test("a page-selection failure is retryable, so reconciliation does not silently stop", async () => {
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listAllProfileIds: async () => {
          throw new Error("connection reset");
        },
      }),
    });
    await expect(
      activity({ mode: "BACKFILL", cursor: null, limit: 500, months: MONTHS }),
    ).rejects.toMatchObject({ nonRetryable: false });
  });

  test("every profile in the page is recomputed for the same instant", async () => {
    const stamps: number[] = [];
    const activity = createMetricSnapshotBatchActivity({
      store: createStore({
        listAllProfileIds: async () => [1, 2, 3],
        recompute: async ({ computedAt }) => {
          stamps.push(computedAt.getTime());
          return { written: 1, differed: 0 };
        },
      }),
      now: () => new Date("2026-03-15T10:00:00.000Z"),
    });

    await activity({ mode: "BACKFILL", cursor: null, limit: 500, months: MONTHS });

    // One instant for the page: a `computed_at` that drifts mid-page makes the
    // sweep's own staleness comparison ambiguous.
    expect(new Set(stamps).size).toBe(1);
    expect(stamps[0]).toBe(Date.parse("2026-03-15T10:00:00.000Z"));
  });
});
