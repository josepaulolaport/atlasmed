import { describe, expect, test } from "bun:test";
import type { Meilisearch } from "meilisearch";
import * as searchRebuild from "./rebuild";
import {
  deriveFacilityProfileFunnelFields,
  fullSearchSyncWorkflowId,
  mapFacilitySearchDocument,
  mapPersonSearchDocument,
  rebuildSearchIndex,
} from "./rebuild";

describe("search rebuild", () => {
  test("passes explicit full-rebuild timeout and polling interval to every Meilisearch task wait", async () => {
    const waits: Array<[number, { timeout: number; interval: number } | undefined]> = [];
    const client = {
      createIndex: async () => ({ taskUid: 1 }),
      getIndex: async () => ({}),
      index: () => ({
        updateSettings: async () => ({ taskUid: 2 }),
        addDocuments: async () => ({ taskUid: 3 }),
      }),
      tasks: {
        waitForTask: async (taskUid: number, options?: { timeout: number; interval: number }) => {
          waits.push([taskUid, options]);
        },
      },
      swapIndexes: async () => ({ taskUid: 4 }),
      deleteIndex: async () => ({ taskUid: 5 }),
    } as unknown as Meilisearch;

    const search = searchRebuild.createSearchIndexClient(client);
    await Promise.all([1, 2, 3, 4, 5].map((taskUid) => search.waitForTask(taskUid)));

    expect(waits).toEqual([
      [1, { timeout: 6_600_000, interval: 1_000 }],
      [2, { timeout: 6_600_000, interval: 1_000 }],
      [3, { timeout: 6_600_000, interval: 1_000 }],
      [4, { timeout: 6_600_000, interval: 1_000 }],
      [5, { timeout: 6_600_000, interval: 1_000 }],
    ]);
  });

  test("uses deterministic workflow ids for one full target rebuild", () => {
    expect(fullSearchSyncWorkflowId("facilities")).toBe("search-sync-facilities-full");
    expect(fullSearchSyncWorkflowId("persons")).toBe("search-sync-persons-full");
  });

  test("maps only safe eligible facility fields", () => {
    expect(
      mapFacilitySearchDocument({
        id: 1,
        displayName: "Clínica Central",
        legalName: "Clínica Central Ltda",
        tradeName: "Central",
        legalDocument: "123",
        cnesCode: "789",
        city: "São Paulo",
        state: "SP",
        verticalIds: [10],
        territoryIds: [20],
        profileFunnelData: [{
          verticalId: 10,
          purchaseFunnelStage: "NEVER_PURCHASED",
          purchaseIntervalDays: 30,
          purchaseIntervalSource: "DEFAULT",
          manualPurchaseProfile: null,
          lastValidPurchaseDate: null,
        }],
        latitude: -23.55,
        longitude: -46.63,
        deactivatedAt: null,
      })
    ).toEqual({
      id: "1",
      name: "Clínica Central",
      legalName: "Clínica Central Ltda",
      tradeName: "Central",
      legalDocument: "123",
      cnesCode: "789",
      city: "São Paulo",
      state: "SP",
      verticalIds: [10],
      territoryIds: [20],
      territoryAssignmentStatus: "assigned",
      verticalFunnelStages: ["10:NEVER_PURCHASED"],
      verticalPurchaseIntervalSources: ["10:DEFAULT"],
      verticalManualPurchaseProfiles: [],
      purchaseFunnelStagesAny: ["NEVER_PURCHASED"],
      purchaseFunnelStageRank: 0,
      purchaseIntervalDaysMin: 30,
      hasLastValidPurchase: 0,
      lastValidPurchaseSortAt: 0,
      _geo: { lat: -23.55, lng: -46.63 },
    });
  });

  test("derives territoryAssignmentStatus from active profile territoryIds", () => {
    expect(mapFacilitySearchDocument({
      id: 1, displayName: "Com território", legalName: null, tradeName: null,
      legalDocument: null, cnesCode: null, city: null, state: null,
      territoryIds: [42], profileFunnelData: [],
      latitude: null, longitude: null, deactivatedAt: null,
    })?.territoryAssignmentStatus).toBe("assigned");

    expect(mapFacilitySearchDocument({
      id: 2, displayName: "Sem território", legalName: null, tradeName: null,
      legalDocument: null, cnesCode: null, city: null, state: null,
      territoryIds: [], profileFunnelData: [],
      latitude: null, longitude: null, deactivatedAt: null,
    })?.territoryAssignmentStatus).toBe("unassigned");
  });

  test("excludes deactivated facilities", () => {
    expect(mapFacilitySearchDocument({
      id: 1, displayName: "Clínica", legalName: null, tradeName: null,
      legalDocument: null, cnesCode: null, city: null, state: null,
      territoryIds: [], profileFunnelData: [],
      latitude: null, longitude: null,
      deactivatedAt: new Date(),
    })).toBeNull();
  });

  test("maps only safe eligible person fields (Q31)", () => {
    expect(
      mapPersonSearchDocument({
        id: 1,
        firstName: "Ana",
        lastName: "Silva",
        socialName: "Dra. Ana",
        cpf: "12345678901",
        primarySpecialtyLabel: "Cardiologia",
        crmCouncil: "CRM",
        crmNumber: "12345",
        crmState: "SP",
        activeAssociations: [
          { facilityId: 2, territoryId: 22 },
          { facilityId: 1, territoryId: 11 },
          { facilityId: 1, territoryId: 11 },
        ],
        deletedAt: null,
      })
    ).toEqual({
      id: "1",
      name: "Ana Silva",
      socialName: "Dra. Ana",
      cpf: "12345678901",
      specialty: "Cardiologia",
      specialtyNormalized: "cardiologia",
      activeFacilityIds: [1, 2],
      activeTerritoryIds: [11, 22],
      crmCouncil: "CRM",
      crmNumber: "12345",
      crmState: "SP",
    });
  });

  test("exposes hybrid filter and distance-sort index settings", () => {
    const facilityFilterable = [...searchRebuild.FACILITY_SETTINGS.filterableAttributes];
    expect(facilityFilterable).toEqual(
      expect.arrayContaining([
        "id",
        "verticalIds",
        "territoryIds",
        "territoryAssignmentStatus",
        "_geo",
      ])
    );
    expect(facilityFilterable).not.toContain("commercialStatus");
    expect(facilityFilterable).not.toContain("territoryId");
    expect(searchRebuild.FACILITY_SETTINGS.sortableAttributes).toEqual(expect.arrayContaining([
      "_geo", "name", "purchaseFunnelStageRank", "purchaseIntervalDaysMin",
      "hasLastValidPurchase", "lastValidPurchaseSortAt", "id",
    ]));
    expect(searchRebuild.PERSON_SETTINGS.filterableAttributes).toEqual(
      expect.arrayContaining(["specialtyNormalized", "activeFacilityIds", "activeTerritoryIds"])
    );
  });

  test("publishes the completed temporary index when no stable index exists", async () => {
    const events: string[] = [];
    const search = {
      createIndex: async (uid: string) => {
        events.push(`create:${uid}`);
        return { taskUid: 1 };
      },
      updateSettings: async (uid: string) => {
        events.push(`settings:${uid}`);
        return { taskUid: 2 };
      },
      addDocuments: async (uid: string, documents: unknown[]) => {
        events.push(`documents:${uid}:${documents.length}`);
        return { taskUid: 3 };
      },
      waitForTask: async (taskUid: number) => events.push(`wait:${taskUid}`),
      getIndex: async (uid: string) => {
        events.push(`get:${uid}`);
        throw { cause: { code: "index_not_found" } };
      },
      swapIndexes: async (swaps: Array<{ indexes: [string, string] }>) => {
        events.push(`swap:${swaps[0]?.indexes.join(":")}`);
        return { taskUid: 5 };
      },
      deleteIndex: async (uid: string) => {
        events.push(`delete:${uid}`);
        return { taskUid: 6 };
      },
    };

    await rebuildSearchIndex({
      target: "facilities",
      temporaryIndex: "facilities__tmp",
      search,
      settings: { searchableAttributes: ["name"] },
      pages: [[{ id: "1", name: "A" }]],
    });

    expect(events).toEqual([
      "create:facilities__tmp",
      "wait:1",
      "settings:facilities__tmp",
      "wait:2",
      "documents:facilities__tmp:1",
      "wait:3",
      "get:facilities",
      "create:facilities",
      "wait:1",
      "swap:facilities:facilities__tmp",
      "wait:5",
      "delete:facilities__tmp",
      "wait:6",
    ]);
  });

  test("removes the first-publish placeholder if the atomic swap fails", async () => {
    const events: string[] = [];
    const search = {
      createIndex: async (uid: string) => {
        events.push(`create:${uid}`);
        return { taskUid: uid === "facilities" ? 4 : 1 };
      },
      updateSettings: async () => ({ taskUid: 2 }),
      addDocuments: async () => ({ taskUid: 3 }),
      getIndex: async () => {
        throw { cause: { code: "index_not_found" } };
      },
      swapIndexes: async () => ({ taskUid: 5 }),
      deleteIndex: async (uid: string) => {
        events.push(`delete:${uid}`);
        return { taskUid: 6 };
      },
      waitForTask: async (taskUid: number) => {
        events.push(`wait:${taskUid}`);
        if (taskUid === 5) throw new Error("swap failed");
      },
    };

    await expect(rebuildSearchIndex({
      target: "facilities",
      temporaryIndex: "facilities__tmp",
      search,
      settings: { searchableAttributes: ["name"] },
      pages: [[{ id: "1", name: "A" }]],
    })).rejects.toThrow("swap failed");

    expect(events).toEqual([
      "create:facilities__tmp", "wait:1", "wait:2", "wait:3",
      "create:facilities", "wait:4", "wait:5", "delete:facilities", "wait:6",
    ]);
  });

  test("waits for every task before swapping and deleting the retired index", async () => {
    const events: string[] = [];
    const search = {
      createIndex: async (uid: string) => {
        events.push(`create:${uid}`);
        return { taskUid: 1 };
      },
      updateSettings: async (uid: string) => {
        events.push(`settings:${uid}`);
        return { taskUid: 2 };
      },
      addDocuments: async (uid: string, documents: unknown[]) => {
        events.push(`documents:${uid}:${documents.length}`);
        return { taskUid: 3 };
      },
      waitForTask: async (taskUid: number) => events.push(`wait:${taskUid}`),
      getIndex: async (uid: string) => events.push(`get:${uid}`),
      swapIndexes: async (swaps: Array<{ indexes: [string, string] }>) => {
        events.push(`swap:${swaps[0]?.indexes.join(":")}`);
        return { taskUid: 4 };
      },
      deleteIndex: async (uid: string) => {
        events.push(`delete:${uid}`);
        return { taskUid: 5 };
      },
    };

    await rebuildSearchIndex({
      target: "facilities",
      temporaryIndex: "facilities__tmp",
      search,
      settings: { searchableAttributes: ["name"] },
      pages: [[{ id: "1", name: "A" }], [{ id: "2", name: "B" }]],
    });

    expect(events).toEqual([
      "create:facilities__tmp",
      "wait:1",
      "settings:facilities__tmp",
      "wait:2",
      "documents:facilities__tmp:1",
      "wait:3",
      "documents:facilities__tmp:1",
      "wait:3",
      "get:facilities",
      "swap:facilities:facilities__tmp",
      "wait:4",
      "delete:facilities__tmp",
      "wait:5",
    ]);
  });
});

test("keeps profile-derived recurrence fields and vertical memberships in facility search documents", () => {
  expect(mapFacilitySearchDocument({
    id: 1, displayName: "Clínica", legalName: null, tradeName: null,
    legalDocument: null, cnesCode: null, city: null, state: null,
    verticalIds: [10], territoryIds: [20],
    latitude: null, longitude: null,
    deactivatedAt: null,
    profileFunnelData: [{
      verticalId: 10,
      purchaseFunnelStage: "PURCHASE_WINDOW",
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "MANUAL",
      manualPurchaseProfile: "MONTHLY",
      lastValidPurchaseDate: "2026-07-01",
    }],
  })).toMatchObject({
    id: "1",
    verticalIds: [10], territoryIds: [20],
    territoryAssignmentStatus: "assigned",
    verticalFunnelStages: ["10:PURCHASE_WINDOW"],
    verticalPurchaseIntervalSources: ["10:MANUAL"],
    verticalManualPurchaseProfiles: ["10:MONTHLY"],
    purchaseFunnelStagesAny: ["PURCHASE_WINDOW"],
    purchaseFunnelStageRank: 2,
    purchaseIntervalDaysMin: 30,
    hasLastValidPurchase: 1,
  });
  expect(deriveFacilityProfileFunnelFields([
    {
      verticalId: 10,
      purchaseFunnelStage: "OUTSIDE_WINDOW",
      purchaseIntervalDays: 60,
      purchaseIntervalSource: "CALCULATED",
      manualPurchaseProfile: null,
      lastValidPurchaseDate: "2026-06-01",
    },
    {
      verticalId: 20,
      purchaseFunnelStage: "PURCHASE_WINDOW",
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
      manualPurchaseProfile: null,
      lastValidPurchaseDate: "2026-07-01",
    },
  ])).toMatchObject({
    verticalFunnelStages: ["10:OUTSIDE_WINDOW", "20:PURCHASE_WINDOW"],
    purchaseFunnelStagesAny: ["OUTSIDE_WINDOW", "PURCHASE_WINDOW"],
    purchaseFunnelStageRank: 2,
    purchaseIntervalDaysMin: 30,
    hasLastValidPurchase: 1,
  });
  expect(searchRebuild.FACILITY_SETTINGS.filterableAttributes).toEqual(
    expect.arrayContaining([
      "verticalIds",
      "verticalFunnelStages",
      "verticalPurchaseIntervalSources",
      "verticalManualPurchaseProfiles",
      "purchaseFunnelStagesAny",
    ]),
  );
  expect(searchRebuild.FACILITY_SETTINGS.sortableAttributes).toEqual(
    expect.arrayContaining(["purchaseFunnelStageRank", "purchaseIntervalDaysMin", "lastValidPurchaseSortAt"]),
  );
});
