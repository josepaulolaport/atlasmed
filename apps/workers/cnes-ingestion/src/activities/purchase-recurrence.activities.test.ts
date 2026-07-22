import { describe, expect, mock, test } from "bun:test";
import {
  createPurchaseRecurrenceBatchActivity,
  selectReconcileFacilityIds,
  type PurchaseRecurrenceStore,
} from "./purchase-recurrence.activities";

function createStore(overrides: Partial<PurchaseRecurrenceStore> = {}): PurchaseRecurrenceStore {
  return {
    listBackfillFacilityIds: mock(async () => []),
    listChangedOrderFacilityIds: mock(async () => []),
    listDueTransitionFacilityIds: mock(async () => []),
    recalculateFacility: mock(async (facilityId: string) => ({
      facilityId,
      changed: false,
      document: null,
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

    const result = await activity({
      mode: "BACKFILL",
      cursor: "f-002",
      limit: 2,
      today: "2026-07-22",
    });

    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: "f-002", limit: 2 });
    expect(result.nextCursor).toBe("f-004");
  });

  test("RECONCILE merges changed orders and due transitions, deduplicates, and keysets the union", async () => {
    const ids = selectReconcileFacilityIds({
      changedOrderIds: ["f-004", "f-002", "f-004"],
      dueTransitionIds: ["f-003", "f-002", "f-005"],
      cursor: "f-002",
      limit: 2,
    });
    expect(ids).toEqual(["f-003", "f-004"]);
  });

  test("full sweep uses the active-facility keyset in reconcile mode", async () => {
    const listBackfillFacilityIds = mock(async () => ["f-010"]);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({ listBackfillFacilityIds }),
      updateSearchDocuments: async () => {},
    });

    await activity({
      mode: "RECONCILE",
      fullSweep: true,
      cursor: "f-009",
      limit: 500,
      today: "2026-07-22",
      since: "2026-07-22T00:00:00.000Z",
      until: "2026-07-22T02:00:00.000Z",
    });

    expect(listBackfillFacilityIds).toHaveBeenCalledWith({ cursor: "f-009", limit: 500 });
  });
});

describe("purchase recurrence batch processing", () => {
  test("counts no-op snapshots without updating calculated_at or Meilisearch", async () => {
    const updateSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => ["f-001"],
        recalculateFacility: async () => ({ facilityId: "f-001", changed: false, document: null }),
      }),
      updateSearchDocuments,
    });

    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });

    expect(result).toMatchObject({ processed: 1, updated: 0, failed: 0 });
    expect(updateSearchDocuments).not.toHaveBeenCalled();
  });

  test("partially updates Meilisearch with the exported rebuild document shape for changed facilities", async () => {
    const document = { id: "f-001", name: "Hospital", purchaseIntervalDays: 30 } as never;
    const updateSearchDocuments = mock(async () => {});
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => ["f-001"],
        recalculateFacility: async () => ({ facilityId: "f-001", changed: true, document }),
      }),
      updateSearchDocuments,
    });

    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 500, today: "2026-07-22" });

    expect(result.updated).toBe(1);
    expect(updateSearchDocuments).toHaveBeenCalledWith([document]);
  });

  test("bounds facility failures and reports a partial Meilisearch failure", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `f-${String(index).padStart(3, "0")}`);
    const activity = createPurchaseRecurrenceBatchActivity({
      store: createStore({
        listBackfillFacilityIds: async () => ids,
        recalculateFacility: async (facilityId) => {
          if (facilityId === "f-024") return { facilityId, changed: true, document: { id: facilityId } as never };
          throw new Error(`failed ${facilityId}`);
        },
      }),
      updateSearchDocuments: async () => { throw new Error("meili unavailable"); },
    });

    const result = await activity({ mode: "BACKFILL", cursor: null, limit: 25, today: "2026-07-22" });

    expect(result.processed).toBe(25);
    expect(result.failed).toBe(25);
    expect(result.failures).toHaveLength(20);
    expect(result.failures.at(-1)?.message).toContain("additional failures omitted");
  });
});
