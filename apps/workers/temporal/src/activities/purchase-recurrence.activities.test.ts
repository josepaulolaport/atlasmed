import { describe, expect, mock, test } from "bun:test";
import {
  createPurchaseRecurrenceBatchActivity,
  normalizePostgresDate,
  selectReconcileFacilityIds,
  snapshotEquals,
  type PurchaseRecurrenceStore,
} from "./purchase-recurrence.activities";

const document = {
  id: "1",
  name: "Hospital",
  purchaseIntervalDaysMin: 30,
  verticalFunnelStages: ["1:NEVER_PURCHASED"],
} as never;

function createStore(overrides: Partial<PurchaseRecurrenceStore> = {}): PurchaseRecurrenceStore {
  return {
    listBackfillFacilityIds: mock(async () => []),
    listChangedOrderFacilityIds: mock(async () => []),
    listDueTransitionFacilityIds: mock(async () => []),
    listInvalidatedFacilityIds: mock(async () => []),
    readCoveredUntil: mock(async () => null),
    commitCoveredUntil: mock(async () => {}),
    recalculateFacilities: mock(async (facilityIds: number[]) =>
      facilityIds.map((facilityId) => ({ facilityId, changed: false, document }))),
    ...overrides,
  };
}

describe("purchase recurrence batch selection", () => {
  test("BACKFILL uses an id keyset cursor without offsets", async () => {
    const listBackfillFacilityIds = mock(async () => [3, 4]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds }),
      updateSearchDocuments: async () => {},
    });

    const result = await activity({ mode: "BACKFILL", cursor: 2, limit: 2, today: "2026-07-22" });

    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: 2, limit: 2 });
    expect(result.nextCursor).toBe(4);
  });

  test("RECONCILE merges changed orders and due transitions, deduplicates, and keysets the union", () => {
    expect(selectReconcileFacilityIds({
      changedOrderIds: [4, 2, 4],
      dueTransitionIds: [3, 2, 5],
      cursor: 2,
      limit: 2,
    })).toEqual([3, 4]);
  });

  /**
   * A clinic that *lost* an order is reachable from neither of the other two
   * selectors: nothing joins to it through `orders` any more, and it has no
   * transition date to come due. The importer clears its
   * `purchase_recurrence_calculated_at` and this is what picks it back up.
   */
  test("RECONCILE also takes facilities whose snapshot was invalidated", () => {
    expect(selectReconcileFacilityIds({
      changedOrderIds: [4],
      dueTransitionIds: [],
      invalidatedIds: [2, 4],
      cursor: null,
      limit: 10,
    })).toEqual([2, 4]);
  });

  /**
   * The property that makes the keyset safe with several selectors: a full
   * selector cannot be overrun. It contributes `limit` ids of its own at or
   * below its last one, so the page fills before reaching past it and the
   * cursor never skips the ids it did not get to report.
   */
  test("RECONCILE never pages past a selector that came back full", () => {
    // `changedOrderIds` is full at 3 and may hold more between 3 and 900.
    expect(selectReconcileFacilityIds({
      changedOrderIds: [1, 2, 3],
      dueTransitionIds: [500, 900],
      invalidatedIds: [],
      cursor: null,
      limit: 3,
    })).toEqual([1, 2, 3]);

    // Two full selectors, interleaved: the page still stops inside both.
    expect(selectReconcileFacilityIds({
      changedOrderIds: [1, 4],
      dueTransitionIds: [2, 8],
      invalidatedIds: [],
      cursor: null,
      limit: 2,
    })).toEqual([1, 2]);
  });

  test("RECONCILE takes the whole union when no selector was truncated", () => {
    expect(selectReconcileFacilityIds({
      changedOrderIds: [1, 2],
      dueTransitionIds: [500, 900],
      invalidatedIds: [7],
      cursor: null,
      limit: 10,
    })).toEqual([1, 2, 7, 500, 900]);
  });

  test("RECONCILE asks all three selectors", async () => {
    const store = createStore({ listBackfillFacilityIds: async () => [] });
    const activity = createPurchaseRecurrenceBatchActivity({ store, updateSearchDocuments: async () => {} });
    await activity({
      mode: "RECONCILE", cursor: null, limit: 500, today: "2026-07-22",
      since: "2026-07-22T00:00:00.000Z", until: "2026-07-22T02:00:00.000Z",
    });
    expect(store.listInvalidatedFacilityIds).toHaveBeenCalledWith({ cursor: null, limit: 500 });
  });

  test("full sweep uses the active-facility keyset in reconcile mode", async () => {
    const listBackfillFacilityIds = mock(async () => [10]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds }), updateSearchDocuments: async () => {},
    });
    await activity({ mode: "RECONCILE", fullSweep: true, cursor: 9, limit: 500, today: "2026-07-22", since: "2026-07-22T00:00:00.000Z", until: "2026-07-22T02:00:00.000Z" });
    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: 9, limit: 500 });
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
      store: createStore({ listBackfillFacilityIds: async () => [1] }), updateSearchDocuments,
    });
    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(result).toMatchObject({ processed: 1, updated: 0, failed: 0 });
    expect(updateSearchDocuments).toHaveBeenCalledWith([document]);
  });

  test("wraps invalid raw reconcile input as a non-retryable validation failure", async () => {
    const store = createStore();
    const activity = createPurchaseRecurrenceBatchActivity({ store, updateSearchDocuments: async () => {} });

    await expect(activity({ mode: "RECONCILE", cursor: 9, limit: 500, today: "2026-07-22" }))
      .rejects.toMatchObject({
        name: "ApplicationFailure",
        type: "PurchaseRecurrenceValidationFailure",
        nonRetryable: true,
      });
    expect(store.listChangedOrderFacilityIds).not.toHaveBeenCalled();
    expect(store.listDueTransitionFacilityIds).not.toHaveBeenCalled();
  });

  test("wraps page-list DB failures retryably without recalculating or advancing the cursor", async () => {
    const recalculateFacilities = mock(async () => [{ facilityId: 10, changed: true, document }]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => { throw new Error("list query unavailable"); },
        recalculateFacilities,
      }),
      updateSearchDocuments: async () => {},
    });

    await expect(activity({ mode: "BACKFILL", cursor: 9, limit: 500, today: "2026-07-22" }))
      .rejects.toMatchObject({
        name: "ApplicationFailure",
        type: "PurchaseRecurrenceDatabaseFailure",
        nonRetryable: false,
      });
    expect(recalculateFacilities).not.toHaveBeenCalled();
  });

  test("throws retryably on a DB failure and a retry converges without advancing the failed page", async () => {
    let attempts = 0;
    const updateSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => [1],
        recalculateFacilities: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("database unavailable");
          return [{ facilityId: 1, changed: true, document }];
        },
      }),
      updateSearchDocuments,
    });

    await expect(activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" })).rejects.toMatchObject({
      name: "ApplicationFailure",
      nonRetryable: false,
    });
    const retry = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(retry).toMatchObject({ processed: 1, updated: 1, failed: 0, nextCursor: 1 });
    expect(updateSearchDocuments).toHaveBeenCalledWith([document]);
  });

  test("deletes Meili documents when recalculation returns null document", async () => {
    const updateSearchDocuments = mock(async () => {});
    const deleteSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => [7],
        recalculateFacilities: async () => [{ facilityId: 7, changed: true, document: null }],
      }),
      updateSearchDocuments,
      deleteSearchDocuments,
    });

    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(result).toMatchObject({ processed: 1, updated: 1, failed: 0 });
    expect(updateSearchDocuments).not.toHaveBeenCalled();
    expect(deleteSearchDocuments).toHaveBeenCalledWith([7]);
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
        listBackfillFacilityIds: async () => [1],
        recalculateFacilities: async () => [{ facilityId: 1, changed: recalculations++ === 0, document }],
      }),
      updateSearchDocuments,
    });

    await expect(activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" })).rejects.toMatchObject({ name: "ApplicationFailure", nonRetryable: false });
    const retry = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });
    expect(retry).toMatchObject({ processed: 1, updated: 0, failed: 0, nextCursor: 1 });
    expect(updateSearchDocuments).toHaveBeenCalledTimes(2);
  });
});

