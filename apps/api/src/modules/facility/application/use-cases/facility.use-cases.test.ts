import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListFacilitiesUseCase } from "./facility.use-cases";
import type {
  FacilityListRecord,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

function facilityRecord(id: string): FacilityListRecord {
  return {
    id,
    name: `Facility ${id}`,
    neighborhood: null,
    city: null,
    state: null,
    taxIdType: null,
    cnpj: null,
    cpf: null,
    lat: null,
    lng: null,
    territoryId: "territory-1",
    territoryAssignmentStatus: "assigned",
    territoryAssignmentSource: "manual",
    purchaseStatus: null,
    sourceProvider: null,
    externalSourceId: null,
    sourceContentHash: null,
    sourceFirstSeenAt: null,
    sourceLastSeenAt: null,
    sourcePresent: true,
    sourceTracked: false,
    manuallyEditedAt: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    services: [],
    professionalCount: 3,
    consultantName: null,
  };
}

function fakeRepository(
  findAll: FacilityRepository["findAll"],
): FacilityRepository {
  return {
    findAll,
    findAllByIds: async () => [],
    findById: async () => null,
    findByExternalId: async () => null,
    findSourceTrackedByProvider: async () => [],
    create: async () => facilityRecord("created"),
    update: async () => facilityRecord("updated"),
    softDelete: async () => {},
    reactivate: async () => facilityRecord("reactivated"),
    markSourceAbsent: async () => {},
    upsertFromSource: async () => ({
      facility: facilityRecord("upserted"),
      created: true,
      updated: false,
    }),
    findIdsByTerritoryIds: async () => [],
    applyApprovedFieldUpdates: async () => facilityRecord("approved"),
  };
}

describe("ListFacilitiesUseCase", () => {
  it("returns pagination totals from the repository", async () => {
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({
        facilities: [facilityRecord("facility-1")],
        total: 27,
      })),
    });

    const result = await useCase.execute({
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
    });

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
      ...facilityRecord("facility-location"),
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

    const result = await useCase.execute({
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
    });

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
      assignedTerritoryIds: ["territory-1"],
      effectiveTerritoryIds: ["territory-1"],
      analyticsEffectiveTerritoryIds: ["territory-1"],
      territoryIds: ["territory-1"],
      facilityIds: ["facility-1"],
      analyticsFacilityIds: ["facility-1"],
      clinicIds: ["facility-1"],
      analyticsClinicIds: ["facility-1"],
      managedUserIds: [],
      isOperationallyActive: true,
    };
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async (params) => {
        receivedScope = params.scope;
        return { facilities: [], total: 0 };
      }),
    });

    await useCase.execute({ scope });

    expect(receivedScope).toEqual({
      isGlobal: false,
      facilityIds: ["facility-1"],
    });
  });

  it("hydrates Meilisearch facility candidates in rank order while applying canonical scope and filters", async () => {
    let hydratedIds: string[] | undefined;
    let receivedParams: unknown;
    let searchCalls = 0;
    const repository = fakeRepository(async () => ({ facilities: [], total: 0 }));
    repository.findAllByIds = async (params) => {
      hydratedIds = params.ids;
      receivedParams = params;
      return [facilityRecord("facility-1"), facilityRecord("facility-2")];
    };
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => {
          searchCalls += 1;
          return {
            hits: [{ id: "facility-2" }, { id: "facility-1" }] as unknown as T[],
            estimatedTotalHits: 8,
          };
        },
      },
    });

    const result = await useCase.execute({
      search: "  12345678000199  ",
      page: 2,
      limit: 2,
      commercialStatus: "ACTIVE",
      productIds: ["product-1"],
      scope: {
        isGlobal: false,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: ["facility-1", "facility-2"],
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    });

    expect(searchCalls).toBe(1);
    expect(hydratedIds).toEqual(["facility-2", "facility-1"]);
    expect(receivedParams).toMatchObject({
      commercialStatus: "ACTIVE",
      productIds: ["product-1"],
      scope: { isGlobal: false, facilityIds: ["facility-1", "facility-2"] },
    });
    expect(result.data.map((facility) => facility.id)).toEqual(["facility-2", "facility-1"]);
    expect(result.pagination.total).toBe(8);
  });

  it("returns a short Meilisearch page when canonical hydration rejects stale candidates", async () => {
    const repository = fakeRepository(async () => ({ facilities: [], total: 0 }));
    repository.findAllByIds = async () => [facilityRecord("facility-2")];
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [{ id: "facility-1" }, { id: "facility-2" }] as unknown as T[],
          estimatedTotalHits: 2,
        }),
      },
    });

    const result = await useCase.execute({ search: "CNES", limit: 2, scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } });

    expect(result.data.map((facility) => facility.id)).toEqual(["facility-2"]);
    expect(result.pagination.total).toBe(2);
  });

  it("returns a typed 503 error when Meilisearch is unavailable", async () => {
    const useCase = new ListFacilitiesUseCase({
      facilityRepository: fakeRepository(async () => ({ facilities: [], total: 0 })),
      searchService: { isConfigured: () => false, search: async () => ({ hits: [] }) },
    });

    await expect(
      useCase.execute({ search: "CNPJ", scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", statusCode: 503 });
  });

  it("prefilters textual facility search by representable status, facility scope, radius, and distance sort", async () => {
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

    await useCase.execute({
      search: "central",
      commercialStatus: "ACTIVE",
      latitude: -23.55,
      longitude: -46.63,
      radiusKm: 5,
      sort: "distance",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: ["facility-2", "facility-1"], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(options).toEqual({
      limit: 20,
      offset: 0,
      filter: "commercialStatus = 'ACTIVE' AND _geoRadius(-23.55, -46.63, 5000) AND id IN ['facility-1', 'facility-2']",
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
    await useCase.execute({
      search: "central",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });
    expect(options?.filter).toBe("id = '__none__'");
  });

  it("keeps representable facility filters when the scope expression exceeds the safe bound", async () => {
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
      search: "central",
      commercialStatus: "ACTIVE",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: Array.from({ length: 1_000 }, (_, index) => `facility-${index}-${"x".repeat(20)}`), analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(options?.filter).toBe("commercialStatus = 'ACTIVE'");
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

    await useCase.execute({ search: "   ", scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } });

    expect(searchCalls).toBe(0);
  });

});
