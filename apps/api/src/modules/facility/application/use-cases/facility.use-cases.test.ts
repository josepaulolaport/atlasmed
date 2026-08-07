import { Role } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListFacilitiesUseCase } from "./facility.use-cases";
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
    purchaseStatus: null,
    conformityStatus: "INCOMPLETE",
    cnesCode: null,
    facilityTypeCode: null,
    unitTypeCode: null,
    unitSubtypeCode: null,
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
      verticalId: 1,
      commercialStatus: null,
      purchaseStatus: null,
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

  it("returns a short Meilisearch page when canonical hydration rejects stale candidates", async () => {
    const repository = fakeRepository(async () => ({ facilities: [], total: 0 }));
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

    expect(result.data.map((facility) => facility.id)).toEqual([2]);
    expect(result.pagination.total).toBe(2);
  });

  it("returns a typed 503 error when Meilisearch is unavailable", async () => {
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
      searchService: { isConfigured: () => false, search: async () => ({ hits: [] }) },
    });

    await expect(
      useCase.execute(withRole({ search: "CNPJ", scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } }))
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", statusCode: 503 });
  });

  it("prefilters textual facility search by facility scope, radius, and distance sort (status in Postgres)", async () => {
    let options: unknown;
    const repository = fakeRepository(async () => ({ facilities: [], total: 0 }));
    repository.findAllByIds = async () => [];
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
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
  });

  it("prefilters an empty non-global facility scope to no Meilisearch documents", async () => {
    let options: { filter?: string } | undefined;
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
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
  });

  it("drops oversized scope filter and keeps geo/vertical Meili clauses when bound exceeded", async () => {
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

    await useCase.execute(withRole({
      search: "central",
      commercialStatus: "REGISTERED",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: Array.from({ length: 2_500 }, (_, index) => index + 1), analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    }));

    // commercialStatus is applied in Postgres hydrate; oversized id IN is dropped.
    expect(options?.filter).toBeUndefined();
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

});
