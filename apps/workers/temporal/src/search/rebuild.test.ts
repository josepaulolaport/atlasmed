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
        streetAddress: "Rua Augusta",
        neighborhood: "Consolação",
        unitTypeId: 3,
        legalDocumentType: "CNPJ",
        clinicalFocusIds: [9, 4],
        verticalIds: [10],
        territoryIds: [20],
        repUserIds: [7, 3, 3],
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
      streetAddress: "Rua Augusta",
      neighborhood: "Consolação",
      unitTypeId: 3,
      legalDocumentType: "CNPJ",
      clinicalFocusIds: [4, 9],
      verticalIds: [10],
      territoryIds: [20],
      repUserIds: [3, 7],
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
        activeAssociations: [
          // Clinic 2 is an administrative link only — she is attached to it but
          // does not practise there.
          { facilityId: 2, territoryId: 22 },
          { facilityId: 1, territoryId: 11, isClinical: true },
          { facilityId: 1, territoryId: 11, isClinical: true },
        ],
        registrationDisplays: ["CRM/SP 123456", "CRM/RJ 654321"],
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
      // Narrower than activeFacilityIds on purpose: clinic 2 is absent, so the
      // associate picker still offers her there.
      clinicalFacilityIds: [1],
      activeTerritoryIds: [11, 22],
      registrationDisplays: ["CRM/SP 123456", "CRM/RJ 654321"],
    });
  });

  test("carries the clinical flag from the row into the association", () => {
    // Without this the field is empty on every document, the exclusion matches
    // nobody, and the only symptom is that every search in the picker falls
    // back to SQL.
    const merged = searchRebuild.mergePersonAssociations([
      { personId: 1, facilityId: 9, territoryId: null, isClinical: true },
      { personId: 1, facilityId: 8, territoryId: null, isClinical: false },
    ]);

    expect(merged.get(1)).toEqual([
      { facilityId: 9, territoryId: null, isClinical: true },
      { facilityId: 8, territoryId: null, isClinical: false },
    ]);
  });

  test("a clinical duplicate does not lose its flag to an administrative one", () => {
    // Two links to the same clinic collapse into one association. Whichever row
    // the database returned first, the person practises there.
    const clinicalLast = searchRebuild.mergePersonAssociations([
      { personId: 1, facilityId: 9, territoryId: 4, isClinical: false },
      { personId: 1, facilityId: 9, territoryId: 4, isClinical: true },
    ]);
    const clinicalFirst = searchRebuild.mergePersonAssociations([
      { personId: 1, facilityId: 9, territoryId: 4, isClinical: true },
      { personId: 1, facilityId: 9, territoryId: 4, isClinical: false },
    ]);

    expect(clinicalLast.get(1)).toEqual([
      { facilityId: 9, territoryId: 4, isClinical: true },
    ]);
    expect(clinicalLast.get(1)).toEqual(clinicalFirst.get(1)!);
  });

  test("a person with no clinical link anywhere gets an empty list, not a missing field", () => {
    // Meili cannot filter an attribute some documents omit, and a person who is
    // purely an administrative contact is exactly the case the exclusion has to
    // reason about.
    const document = mapPersonSearchDocument({
      id: 5,
      firstName: "Bruno",
      lastName: "Costa",
      socialName: null,
      cpf: null,
      primarySpecialtyLabel: null,
      activeAssociations: [{ facilityId: 9, territoryId: null }],
      deletedAt: null,
    });

    expect(document).toHaveProperty("clinicalFacilityIds", []);
    expect(document?.activeFacilityIds).toEqual([9]);
  });

  test("defaults registrationDisplays to empty when omitted", () => {
    expect(
      mapPersonSearchDocument({
        id: 2,
        firstName: "Bia",
        lastName: "Costa",
        socialName: null,
        cpf: null,
        primarySpecialtyLabel: null,
        activeAssociations: [],
        deletedAt: null,
      })?.registrationDisplays
    ).toEqual([]);
  });

  test("carries every per-facility association into the rebuilt document", () => {
    // The rebuild is where a filterable attribute goes wrong most quietly: if
    // the page builder does not populate it, the index is rebuilt with the
    // field empty on every document, the filter then matches nothing, and
    // facilities that do match disappear from search with no error anywhere.
    const row = {
      id: 1,
      displayName: "Clínica Central",
      legalName: null,
      tradeName: null,
      legalDocument: null,
      cnesCode: null,
      city: null,
      state: null,
      unitTypeId: 3,
      legalDocumentType: "CNPJ",
      latitude: null,
      longitude: null,
      deactivatedAt: null,
    };

    const [document] = searchRebuild.buildFacilityPageDocuments(
      [row],
      {
        verticalIds: new Map([[1, [10]]]),
        territoryIds: new Map([[1, [20]]]),
        repUserIds: new Map([[1, [7]]]),
        funnelData: new Map(),
      },
      new Map([[1, [9, 4]]]),
    );

    expect(document).toMatchObject({
      id: "1",
      unitTypeId: 3,
      legalDocumentType: "CNPJ",
      clinicalFocusIds: [4, 9],
      verticalIds: [10],
      territoryIds: [20],
      repUserIds: [7],
    });
  });

  test("leaves associations empty for a facility that has none", () => {
    const [document] = searchRebuild.buildFacilityPageDocuments(
      [{
        id: 2,
        displayName: "Sem vínculos",
        legalName: null,
        tradeName: null,
        legalDocument: null,
        cnesCode: null,
        city: null,
        state: null,
        latitude: null,
        longitude: null,
        deactivatedAt: null,
      }],
      {
        verticalIds: new Map(),
        territoryIds: new Map(),
        repUserIds: new Map(),
        funnelData: new Map(),
      },
      new Map(),
    );

    expect(document).toMatchObject({
      clinicalFocusIds: [],
      unitTypeId: null,
      legalDocumentType: null,
    });
  });

  test("drops deactivated facilities from the page", () => {
    expect(
      searchRebuild.buildFacilityPageDocuments(
        [{
          id: 3,
          displayName: "Fechada",
          legalName: null,
          tradeName: null,
          legalDocument: null,
          cnesCode: null,
          city: null,
          state: null,
          latitude: null,
          longitude: null,
          deactivatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }],
        {
          verticalIds: new Map(),
          territoryIds: new Map(),
          repUserIds: new Map(),
          funnelData: new Map(),
        },
        new Map(),
      ),
    ).toEqual([]);
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
    // Explorar filters on these. A name missing here is not a build failure —
    // Meili rejects the query at runtime and the API quietly falls back to
    // SQL, so the feature keeps working and only the latency shows it.
    expect(facilityFilterable).toEqual(
      expect.arrayContaining([
        "unitTypeId",
        "legalDocumentType",
        "clinicalFocusIds",
      ])
    );
    // Order history is deliberately absent: nothing re-indexes a facility when
    // an order is created, so an indexed copy would go stale and silently drop
    // facilities that do match.
    expect(facilityFilterable).not.toContain("productIds");
    expect(searchRebuild.FACILITY_SETTINGS.searchableAttributes).toEqual(
      expect.arrayContaining(["streetAddress", "neighborhood", "city", "state"])
    );
    expect(searchRebuild.FACILITY_SETTINGS.filterableAttributes).toEqual(
      expect.arrayContaining(["repUserIds", "territoryIds", "verticalIds"])
    );
    expect(searchRebuild.FACILITY_SETTINGS.sortableAttributes).toEqual(expect.arrayContaining([
      "_geo", "name", "purchaseFunnelStageRank", "purchaseIntervalDaysMin",
      "hasLastValidPurchase", "lastValidPurchaseSortAt", "id",
    ]));
    expect(searchRebuild.PERSON_SETTINGS.filterableAttributes).toEqual(
      // clinicalFacilityIds is what the associate-doctors exclusion filters on.
      // Missing here, Meili rejects the filter at runtime and the request falls
      // back to SQL — correct, but the whole point of indexing it is lost.
      expect.arrayContaining([
        "specialtyNormalized",
        "activeFacilityIds",
        "clinicalFacilityIds",
        "activeTerritoryIds",
      ])
    );
    expect(searchRebuild.PERSON_SETTINGS.searchableAttributes).toEqual(
      expect.arrayContaining([
        "name",
        "socialName",
        "cpf",
        "specialty",
        "registrationDisplays",
      ])
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
      deleteDocuments: async () => ({ taskUid: 7 }),
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
      deleteDocuments: async () => ({ taskUid: 7 }),
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
      deleteDocuments: async () => ({ taskUid: 7 }),
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

    /*
     * Pages are enqueued together and awaited together, rather than one at a
     * time. Waiting per page defeats Meilisearch's own batching — it merges
     * consecutive queued document tasks into one indexing pass only if several
     * are queued — and that is what made a 373 435-document rebuild take
     * nineteen minutes.
     */
    expect(events).toEqual([
      "create:facilities__tmp",
      "wait:1",
      "settings:facilities__tmp",
      "wait:2",
      "documents:facilities__tmp:1",
      "documents:facilities__tmp:1",
      "wait:3",
      "wait:3",
      "get:facilities",
      "swap:facilities:facilities__tmp",
      "wait:4",
      "delete:facilities__tmp",
      "wait:5",
    ]);

    /*
     * The invariant the interleaving above is only one expression of, asserted
     * on its own so a future reordering cannot quietly swap a half-built index
     * into place: every document task is awaited before the swap.
     */
    const swapAt = events.indexOf("swap:facilities:facilities__tmp");
    const lastDocumentWaitAt = events.lastIndexOf("wait:3");
    expect(lastDocumentWaitAt).toBeGreaterThan(-1);
    expect(lastDocumentWaitAt).toBeLessThan(swapAt);
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
