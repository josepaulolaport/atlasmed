import { describe, expect, mock, test } from "bun:test";
import {
  createPurchaseRecurrenceBatchActivity,
  normalizePostgresDate,
  selectReconcileFacilityIds,
  snapshotEquals,
  type PurchaseRecurrenceStore,
} from "./purchase-recurrence.activities";

const document = { id: "f-001", name: "Hospital", purchaseIntervalDays: 30 } as never;

function createStore(overrides: Partial<PurchaseRecurrenceStore> = {}): PurchaseRecurrenceStore {
  return {
    listBackfillFacilityIds: mock(async () => []),
    listChangedOrderFacilityIds: mock(async () => []),
    listDueTransitionFacilityIds: mock(async () => []),
    recalculateFacility: mock(async (facilityId: string) => ({
      facilityId,
      changed: false,
      document,
    })),
    ...overrides,
  };
}

describe("purchase recurrence batch selection", () => {
  test("BACKFILL uses an id keyset cursor without offsets", async () => {
    const listBackfillFacilityIds = mock(async () => ["f-003", "f-004"]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds }),
      updateSearchDocuments: async () => {},
    });

    const result = await activity({ mode: "BACKFILL", cursor: "f-002", limit: 2, today: "2026-07-22" });

    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: "f-002", limit: 2 });
    expect(result.nextCursor).toBe("f-004");
  });

  test("RECONCILE merges changed orders and due transitions, deduplicates, and keysets the union", () => {
    expect(selectReconcileFacilityIds({
      changedOrderIds: ["f-004", "f-002", "f-004"],
      dueTransitionIds: ["f-003", "f-002", "f-005"],
      cursor: "f-002",
      limit: 2,
    })).toEqual(["f-003", "f-004"]);
  });

  test("full sweep uses the active-facility keyset in reconcile mode", async () => {
    const listBackfillFacilityIds = mock(async () => ["f-010"]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds }), updateSearchDocuments: async () => {},
    });
    await activity({ mode: "RECONCILE", fullSweep: true, cursor: "f-009", limit: 500, today: "2026-07-22", since: "2026-07-22T00:00:00.000Z", until: "2026-07-22T02:00:00.000Z" });
    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: "f-009", limit: 500 });
  });
});

describe("purchase recurrence date normalization", () => {
  test("normalizes PostgreSQL strings and Date values to UTC YYYY-MM-DD", () => {
    expect(normalizePostgresDate("2026-07-22")).toBe("2026-07-22");
    expect(normalizePostgresDate(new Date("2026-07-22T00:00:00.000Z"))).toBe("2026-07-22");
    expect(normalizePostgresDate(null)).toBeNull();
  });

  test("treats a Date-valued persisted snapshot as a no-op", () => {
    expect(snapshotEquals({
      observedPurchaseIntervalDays: 30,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "CALCULATED",
      manualPurchaseProfile: null,
      manualPurchaseIntervalDays: null,
      lastValidPurchaseDate: new Date("2026-07-22T00:00:00.000Z"),
      purchaseRecurrenceSampleSize: 2,
      purchaseFunnelStage: "OUTSIDE_WINDOW",
      nextPurchaseFunnelTransitionDate: new Date("2026-08-06T00:00:00.000Z"),
    }, {
      observedPurchaseIntervalDays: 30,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "CALCULATED",
      manualPurchaseProfile: null,
      manualPurchaseIntervalDays: null,
      lastValidPurchaseDate: "2026-07-22",
      purchaseRecurrenceSampleSize: 2,
      purchaseFunnelStage: "OUTSIDE_WINDOW",
      nextPurchaseFunnelTransitionDate: "2026-08-06",
    })).toBe(true);
  });
});

describe("purchase recurrence batch processing", () => {
  test("publishes documents for processed no-op snapshots without incrementing updated", async () => {
    const updateSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds: async () => ["f-001"] }), updateSearchDocuments,
    });
    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(result).toMatchObject({ processed: 1, updated: 0, failed: 0 });
    expect(updateSearchDocuments).toHaveBeenCalledWith([document]);
  });

  test("wraps invalid raw reconcile input as a non-retryable validation failure", async () => {
    const store = createStore();
    const activity = createPurchaseRecurrenceBatchActivity({ store, updateSearchDocuments: async () => {} });

    await expect(activity({ mode: "RECONCILE", cursor: "f-009", limit: 500, today: "2026-07-22" }))
      .rejects.toMatchObject({
        name: "ApplicationFailure",
        type: "PurchaseRecurrenceValidationFailure",
        nonRetryable: true,
      });
    expect(store.listChangedOrderFacilityIds).not.toHaveBeenCalled();
    expect(store.listDueTransitionFacilityIds).not.toHaveBeenCalled();
  });

  test("wraps page-list DB failures retryably without recalculating or advancing the cursor", async () => {
    const recalculateFacility = mock(async () => ({ facilityId: "f-010", changed: true, document }));
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => { throw new Error("list query unavailable"); },
        recalculateFacility,
      }),
      updateSearchDocuments: async () => {},
    });

    await expect(activity({ mode: "BACKFILL", cursor: "f-009", limit: 500, today: "2026-07-22" }))
      .rejects.toMatchObject({
        name: "ApplicationFailure",
        type: "PurchaseRecurrenceDatabaseFailure",
        nonRetryable: false,
      });
    expect(recalculateFacility).not.toHaveBeenCalled();
  });

  test("throws retryably on a DB failure and a retry converges without advancing the failed page", async () => {
    let attempts = 0;
    const updateSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => ["f-001"],
        recalculateFacility: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("database unavailable");
          return { facilityId: "f-001", changed: true, document };
        },
      }),
      updateSearchDocuments,
    });

    await expect(activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" })).rejects.toMatchObject({
      name: "ApplicationFailure",
      nonRetryable: false,
    });
    const retry = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(retry).toMatchObject({ processed: 1, updated: 1, failed: 0, nextCursor: "f-001" });
    expect(updateSearchDocuments).toHaveBeenCalledWith([document]);
  });

  test("re-publishes a no-op persisted document after Meilisearch fails on the first attempt", async () => {
    let recalculations = 0;
    let publications = 0;
    const updateSearchDocuments = mock(async (documents: unknown[]) => {
      publications += 1;
      expect(documents).toEqual([document]);
      if (publications === 1) throw new Error("meili unavailable");
    });
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => ["f-001"],
        recalculateFacility: async () => ({ facilityId: "f-001", changed: recalculations++ === 0, document }),
      }),
      updateSearchDocuments,
    });

    await expect(activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" })).rejects.toMatchObject({ name: "ApplicationFailure", nonRetryable: false });
    const retry = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(retry).toMatchObject({ processed: 1, updated: 0, failed: 0, nextCursor: "f-001" });
    expect(updateSearchDocuments).toHaveBeenCalledTimes(2);
  });
});
