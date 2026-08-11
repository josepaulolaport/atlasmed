import { Role } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListFacilitiesUseCase, parseMeiliFacilityIds } from "./facility.use-cases";
import type {
  FacilityListRecord,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

function facilityRecord(id: number): FacilityListRecord {
  return {
    id,
    name: `Facility ${id}`,
    neighborhood: null,
    city: null,
    state: null,
    streetAddress: null,
    streetNumber: null,
    addressComplement: null,
    postalCode: null,
    stateId: 1,
    municipalityId: 1,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    billingEmail: null,
    responsibleName: null,
    openingHours: null,
    legalDocumentType: "CNPJ",
    legalDocument: null,
    lat: null,
    lng: null,
    territoryId: 1,
    territoryName: null,
    territoryAssignmentStatus: "assigned",
    commercialStatus: null,
    cnesCode: null,
    unitTypeId: null,
    unitSubtypeId: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    clinicalFocuses: [],
    professionalCount: 3,
    lastVisitAt: null,
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
    imageBlurhash: null,
  };
}

function fakeRepository(
  findAll: FacilityRepository["findAll"],
): FacilityRepository {
  return {
    findAll,
    findAllByIds: async () => [],
    findById: async () => null,
    listClinicalFocusCatalog: async () => [],
    create: async () => facilityRecord(100),
    update: async () => facilityRecord(101),
    softDelete: async () => {},
    reactivate: async () => facilityRecord(102),
    findIdsByTerritoryIds: async () => [],
    listMapPoints: async () => [],
    applyApprovedFieldUpdates: async () => facilityRecord(103),
    findActiveFacilityIdsByVerticalIds: async () => [],
    findVerticalProfilesByFacilityIds: async () => new Map(),
    updateVerticalProfileCommercialStatus: async () => {},
    ensureVerticalProfile: async () => ({
      id: 901,
      verticalId: 1,
      commercialStatus: null,
      isActive: true,
    }),
  };
}

const adminRole = Role.ADMIN;

function withRole<T extends Record<string, unknown>>(input: T) {
  return { ...input, role: adminRole, userId: 1 };
}

describe("ListFacilitiesUseCase", () => {
  it("returns pagination totals from the repository", async () => {
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({
        facilities: [facilityRecord(1)],
        total: 27,
      })),
    });

    const result = await useCase.execute(withRole({
      page: 2,
      limit: 10,
      scope: {
  isGlobal: true,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  facilityIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
},
    }));

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 27,
      totalPages: 3,
    });
  });

  it("serializes neighborhood, city, and state in list DTOs", async () => {
    const facility = {
      ...facilityRecord(42),
      neighborhood: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    };
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({
        facilities: [facility],
        total: 1,
      })),
    });

    const result = await useCase.execute(withRole({
      scope: {
        isGlobal: true,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: [],
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    }));

    expect(result.data[0]).toMatchObject({
      neighborhood: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    });
  });

  it("passes scoped facility ids to the repository", async () => {
    let receivedScope: unknown;
    const scope: ScopeContext = {
      isGlobal: false,
      assignedTerritoryIds: [1],
      effectiveTerritoryIds: [1],
      analyticsEffectiveTerritoryIds: [1],
      territoryIds: [1],
      facilityIds: [1],
      analyticsFacilityIds: [1],
      clinicIds: [1],
      analyticsClinicIds: [1],
      managedUserIds: [],
      isOperationallyActive: true,
    };
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async (params) => {
        receivedScope = params.scope;
        return { facilities: [], total: 0 };
      }),
    });

    await useCase.execute(withRole({ scope }));

    expect(receivedScope).toEqual({
      isGlobal: false,
      facilityIds: [1],
      restrictToVerticalProfiles: true,
      verticalIds: [],
    });
  });

  it("hydrates Meilisearch facility candidates in rank order while applying canonical scope and filters", async () => {
    let hydratedIds: number[] | undefined;
    let receivedParams: unknown;
    let searchCalls = 0;
    const repository = fakeRepository(async () => ({ facilities: [], total: 0 }));
    repository.findAllByIds = async (params) => {
      hydratedIds = params.ids;
      receivedParams = params;
      return [facilityRecord(1), facilityRecord(2)];
    };
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => {
          searchCalls += 1;
          return {
            hits: [{ id: 2 }, { id: 1 }] as unknown as T[],
            estimatedTotalHits: 8,
          };
        },
      },
    });

    const result = await useCase.execute(withRole({
      search: "  12345678000199  ",
      page: 2,
      limit: 2,
      commercialStatus: "REGISTERED",
      productIds: [1],
      scope: {
        isGlobal: false,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: [1, 2],
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    }));

    expect(searchCalls).toBe(1);
    expect(hydratedIds).toEqual([2, 1]);
    expect(receivedParams).toMatchObject({
      commercialStatus: "REGISTERED",
      productIds: [1],
      scope: { isGlobal: false, facilityIds: [1, 2] },
    });
    expect(result.data.map((facility) => facility.id)).toEqual([2, 1]);
    expect(result.pagination.total).toBe(8);
  });

  it("falls back to SQL when Meili hydration drops any hit", async () => {
    let findAllCalls = 0;
    const repository = fakeRepository(async () => {
      findAllCalls += 1;
      return { facilities: [facilityRecord(9)], total: 1 };
    });
    repository.findAllByIds = async () => [facilityRecord(2)];
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [{ id: 1 }, { id: 2 }] as unknown as T[],
          estimatedTotalHits: 2,
        }),
      },
    });

    const result = await useCase.execute(withRole({ search: "CNES", limit: 2, scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } }));

    expect(findAllCalls).toBe(1);
    expect(result.data.map((facility) => facility.id)).toEqual([9]);
    expect(result.pagination.total).toBe(1);
  });

  it("falls back to SQL when Meili returns empty hits", async () => {
    let findAllCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { facilities: [facilityRecord(3)], total: 1 };
        },
        findAllByIds: async () => [],
      } as unknown as FacilityRepository,
      searchService: {
        isConfigured: () => true,
        search: async () => ({ hits: [], estimatedTotalHits: 0 }),
      },
    });

    const result = await useCase.execute(
      withRole({
        search: "Augusta",
        scope: {
          isGlobal: true,
          assignedTerritoryIds: [],
          effectiveTerritoryIds: [],
          analyticsEffectiveTerritoryIds: [],
          territoryIds: [],
          facilityIds: [],
          analyticsFacilityIds: [],
          clinicIds: [],
          analyticsClinicIds: [],
          managedUserIds: [],
          isOperationallyActive: true,
        },
      }),
    );

    expect(findAllCalls).toBe(1);
    expect(result.data.map((f) => f.id)).toEqual([3]);
  });

  it("falls back to SQL when Meilisearch is not configured", async () => {
    let findAllCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { facilities: [facilityRecord(9)], total: 1 };
        },
        findAllByIds: async () => [],
      } as unknown as FacilityRepository,
      searchService: { isConfigured: () => false, search: async () => ({ hits: [] }) },
    });

    const result = await useCase.execute(
      withRole({
        search: "CNPJ",
        scope: {
          isGlobal: true,
          assignedTerritoryIds: [],
          effectiveTerritoryIds: [],
          analyticsEffectiveTerritoryIds: [],
          territoryIds: [],
          facilityIds: [],
          analyticsFacilityIds: [],
          clinicIds: [],
          analyticsClinicIds: [],
          managedUserIds: [],
          isOperationallyActive: true,
        },
      }),
    );

    expect(findAllCalls).toBe(1);
    expect(result.data.map((f) => f.id)).toEqual([9]);
  });

  it("prefilters textual facility search by facility scope, radius, and distance sort (status in Postgres)", async () => {
    let options: unknown;
    let findAllCalls = 0;
    const repository = fakeRepository(async () => {
      findAllCalls += 1;
      return { facilities: [], total: 0 };
    });
    repository.findAllByIds = async () => [];
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          // Empty Meili → SQL fallback (still verified Meili filter shape first).
          return { hits: [], estimatedTotalHits: 0 };
        },
      },
    });

    await useCase.execute(withRole({
      search: "central",
      commercialStatus: "REGISTERED",
      latitude: -23.55,
      longitude: -46.63,
      radiusKm: 5,
      sort: "distance",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [2, 1], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    }));

    expect(options).toEqual({
      limit: 20,
      offset: 0,
      filter: "_geoRadius(-23.55, -46.63, 5000) AND id IN [1, 2]",
      sort: ["_geoPoint(-23.55, -46.63):asc"],
    });
    expect(findAllCalls).toBe(1);
  });

  it("prefilters an empty non-global facility scope then falls back to SQL on empty Meili", async () => {
    let options: { filter?: string } | undefined;
    let findAllCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { facilities: [], total: 0 };
        },
        findAllByIds: async () => [],
      } as unknown as FacilityRepository,
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => { options = received; return { hits: [] }; },
      },
    });
    await useCase.execute(withRole({
      search: "central",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    }));
    expect(options?.filter).toBe("id = -1");
    expect(findAllCalls).toBe(1);
  });

  it("falls back to SQL when Meili scope filter exceeds length bound", async () => {
    let searchCalls = 0;
    let findAllCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { facilities: [], total: 0 };
        },
        findAllByIds: async () => [],
      } as unknown as FacilityRepository,
      searchService: {
        isConfigured: () => true,
        search: async () => {
          searchCalls += 1;
          return { hits: [] };
        },
      },
    });

    await useCase.execute(withRole({
      search: "central",
      commercialStatus: "REGISTERED",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: Array.from({ length: 2_500 }, (_, index) => index + 1), analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    }));

    // Oversized id IN → SQL before Meili (never drop scope).
    expect(searchCalls).toBe(0);
    expect(findAllCalls).toBe(1);
  });

  it("does not call Meilisearch for blank facility searches", async () => {
    let searchCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async () => {
          searchCalls += 1;
          return { hits: [], estimatedTotalHits: 0 };
        },
      },
    });

    await useCase.execute(withRole({ search: "   ", scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } }));

    expect(searchCalls).toBe(0);
  });

  it("falls back to SQL when Meili search throws", async () => {
    let findAllCalls = 0;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { facilities: [facilityRecord(1)], total: 1 };
        },
        findAllByIds: async () => [],
      } as unknown as FacilityRepository,
      searchService: {
        isConfigured: () => true,
        search: async () => {
          throw new Error("Attribute purchaseFunnelStagesAny is not filterable");
        },
      },
    });

    const result = await useCase.execute(
      withRole({
        search: "Rua",
        purchaseBucket: "neverBought",
        scope: {
          isGlobal: true,
          assignedTerritoryIds: [],
          effectiveTerritoryIds: [],
          analyticsEffectiveTerritoryIds: [],
          territoryIds: [],
          facilityIds: [],
          analyticsFacilityIds: [],
          clinicIds: [],
          analyticsClinicIds: [],
          managedUserIds: [],
          isOperationallyActive: true,
        },
      }),
    );

    expect(findAllCalls).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it("uses compact REP Meili scope (repUserIds) instead of giant facilityIds IN", async () => {
    let options: { filter?: string } | undefined;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          return { hits: [] };
        },
      },
    });

    await useCase.execute({
      search: "Augusta",
      role: Role.REP,
      userId: 77,
      scope: {
        isGlobal: false,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    });

    expect(options?.filter).toBe("repUserIds = 77");
  });

  it("uses compact MANAGER Meili scope (territoryIds / oversight zones)", async () => {
    let options: { filter?: string } | undefined;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          return { hits: [] };
        },
      },
    });

    await useCase.execute({
      search: "Augusta",
      role: Role.MANAGER,
      userId: 3,
      scope: {
        isGlobal: false,
        assignedTerritoryIds: [10],
        effectiveTerritoryIds: [10],
        analyticsEffectiveTerritoryIds: [10],
        territoryIds: [10],
        oversightZoneIds: [10, 11],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    });

    expect(options?.filter).toBe("territoryIds IN [10, 11]");
  });
});

describe("parseMeiliFacilityIds", () => {
  it("keeps CRM bigints and drops legacy UUID strings", () => {
    expect(
      parseMeiliFacilityIds([
        { id: 1 },
        { id: "2" },
        { id: "46ebcd8c907149f2a85c4d5c5718703b" },
        { id: "3.0" },
      ]),
    ).toEqual([1, 2]);
  });
});
