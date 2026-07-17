import { describe, expect, test } from "bun:test";
import {
  fullSearchSyncWorkflowId,
  mapFacilitySearchDocument,
  mapProfessionalSearchDocument,
  rebuildSearchIndex,
} from "./rebuild";

describe("search rebuild", () => {
  test("uses deterministic workflow ids for one full target rebuild", () => {
    expect(fullSearchSyncWorkflowId("facilities")).toBe("search-sync-facilities-full");
    expect(fullSearchSyncWorkflowId("professionals")).toBe("search-sync-professionals-full");
  });

  test("maps only safe eligible facility fields", () => {
    expect(
      mapFacilitySearchDocument({
        id: "facility-1",
        displayName: "Clínica Central",
        legalName: "Clínica Central Ltda",
        tradeName: "Central",
        cnpj: "123",
        cpf: "456",
        cnesCode: "789",
        city: "São Paulo",
        state: "SP",
        commercialStatus: "ACTIVE",
        deactivatedAt: null,
        isActiveInRegistry: true,
      })
    ).toEqual({
      id: "facility-1",
      name: "Clínica Central",
      legalName: "Clínica Central Ltda",
      tradeName: "Central",
      cnpj: "123",
      cpf: "456",
      cnesCode: "789",
      city: "São Paulo",
      state: "SP",
      commercialStatus: "ACTIVE",
    });
  });

  test("excludes deactivated or registry-inactive facilities", () => {
    expect(mapFacilitySearchDocument({
      id: "facility-1", displayName: "Clínica", legalName: null, tradeName: null,
      cnpj: null, cpf: null, cnesCode: null, city: null, state: null, commercialStatus: null,
      deactivatedAt: null, isActiveInRegistry: false,
    })).toBeNull();
  });

  test("maps only safe eligible professional fields", () => {
    expect(
      mapProfessionalSearchDocument({
        id: "professional-1",
        firstName: "Ana",
        lastName: "Silva",
        fullName: null,
        socialName: "Dra. Ana",
        taxId: "123",
        primarySpecialtyLabel: "Cardiologia",
        crmCouncil: "CRM",
        crmNumber: "12345",
        crmState: "SP",
        deletedAt: null,
      })
    ).toEqual({
      id: "professional-1",
      name: "Ana Silva",
      socialName: "Dra. Ana",
      taxId: "123",
      specialty: "Cardiologia",
      crmCouncil: "CRM",
      crmNumber: "12345",
      crmState: "SP",
    });
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
      "swap:facilities:facilities__tmp",
      "wait:4",
      "delete:facilities__tmp",
      "wait:5",
    ]);
  });
});
