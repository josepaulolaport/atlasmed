import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  ListProfessionalSpecialtiesUseCase,
  ListProfessionalsUseCase,
} from "./professional.use-cases";
import type {
  ProfessionalRecord,
  ProfessionalRepository,
} from "../interfaces/professional.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

function professionalRecord(id: string): ProfessionalRecord {
  return {
    id,
    firstName: "Ana",
    lastName: "Silva",
    fullName: "Ana Silva",
    socialName: null,
    taxId: null,
    birthDate: null,
    mobilePhone: null,
    landlinePhone: null,
    email: null,
    websiteUrl: null,
    imageUrl: null,
    favoriteTeam: null,
    favoriteSport: null,
    languages: null,
    hobbies: null,
    notes: null,
    specialty: "Cardiologia",
    crmCouncil: null,
    crmNumber: "123456",
    crmState: "SP",
    sourceProvider: null,
    externalSourceId: null,
    sourceContentHash: null,
    sourceFirstSeenAt: null,
    sourceLastSeenAt: null,
    sourcePresent: true,
    sourceTracked: false,
    manuallyEditedAt: null,
    facilityIds: ["facility-1"],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function fakeRepository(
  findAll: ProfessionalRepository["findAll"],
): ProfessionalRepository {
  return {
    findAll,
    listDistinctSpecialties: async () => [],
    findAllByIds: async () => [],
    findById: async () => null,
    findByExternalId: async () => null,
    findSourceTrackedByProvider: async () => [],
    findActiveFacilities: async () => [],
    create: async () => professionalRecord("created"),
    update: async () => professionalRecord("updated"),
    softDelete: async () => {},
    markSourceAbsent: async () => {},
    upsertFromSource: async () => ({
      professional: professionalRecord("upserted"),
      created: true,
      updated: false,
    }),
    findExistingFacilityIds: async (ids) => ids,
    findNotesByProfessionalAndUser: async () => [],
    createNote: async () => ({ id: "note-1", userId: "user-1", professionalId: "professional-1", note: "note", createdAt: now, updatedAt: now }),
  };
}

describe("ListProfessionalSpecialtiesUseCase", () => {
  it("returns distinct specialties under the caller's facility scope", async () => {
    const repository = fakeRepository(async () => ({ professionals: [], total: 0 }));
    repository.listDistinctSpecialties = mock(async () => ["Cardiologia", "Ortopedia"]);

    const result = await new ListProfessionalSpecialtiesUseCase({
      doctorRepository: repository,
    }).execute({
      scope: {
        isGlobal: false,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: ["facility-1"],
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true,
      },
    });

    expect(repository.listDistinctSpecialties).toHaveBeenCalledWith({
      isGlobal: false,
      facilityIds: ["facility-1"],
    });
    expect(result).toEqual({ data: ["Cardiologia", "Ortopedia"] });
  });
});

describe("ListProfessionalsUseCase", () => {
  it("returns pagination totals from the repository", async () => {
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({
        professionals: [professionalRecord("doctor-1")],
        total: 42,
      })),
    });

    const result = await useCase.execute({
      page: 2,
      limit: 20,
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
      limit: 20,
      total: 42,
      totalPages: 3,
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
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async (params) => {
        receivedScope = params.scope;
        return { professionals: [], total: 0 };
      }),
    });

    await useCase.execute({ scope });

    expect(receivedScope).toEqual({
      isGlobal: false,
      facilityIds: ["facility-1"],
    });
  });

  it("hydrates Meilisearch professional candidates in rank order with scope and specialty filters", async () => {
    let receivedParams: unknown;
    const repository = fakeRepository(async () => ({ professionals: [], total: 0 }));
    repository.findAllByIds = async (params) => {
      receivedParams = params;
      return [professionalRecord("professional-1"), professionalRecord("professional-2")];
    };
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: repository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [{ id: "professional-2" }, { id: "professional-1" }] as unknown as T[],
          estimatedTotalHits: 7,
        }),
      },
    });

    const result = await useCase.execute({
      search: "CRM 123456",
      facilityId: "facility-1",
      specialty: "Cardiologia",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: ["facility-1"], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(receivedParams).toMatchObject({
      ids: ["professional-2", "professional-1"],
      facilityId: "facility-1",
      specialty: "Cardiologia",
      scope: { isGlobal: false, facilityIds: ["facility-1"] },
    });
    expect(result.data.map((professional) => professional.id)).toEqual(["professional-2", "professional-1"]);
    expect(result.pagination.total).toBe(7);
  });

  it("returns a typed 503 error when Meilisearch is unavailable", async () => {
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
      searchService: { isConfigured: () => false, search: async () => ({ hits: [] }) },
    });

    await expect(
      useCase.execute({ search: "CRM", scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true } })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", statusCode: 503 });
  });

  it("prefilters textual professional search by normalized specialty, facility, and safe association scope", async () => {
    let options: unknown;
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          return { hits: [] };
        },
      },
    });

    await useCase.execute({
      search: "ana",
      facilityId: "facility-1",
      specialty: " Cirurgia VÁSCULAR ",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: ["facility-2", "facility-1"], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(options).toEqual({
      limit: 20,
      offset: 0,
      filter: "specialtyNormalized = 'cirurgia vascular' AND activeFacilityIds = 'facility-1' AND activeFacilityIds IN ['facility-1', 'facility-2']",
    });
  });

  it("prefilters an empty non-global professional scope to no Meilisearch documents", async () => {
    let options: { filter?: string } | undefined;
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => { options = received; return { hits: [] }; },
      },
    });
    await useCase.execute({
      search: "ana",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });
    expect(options?.filter).toBe("activeFacilityIds = '__none__'");
  });

  it("keeps representable professional filters when association scope exceeds the safe bound", async () => {
    let options: { filter?: string } | undefined;
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          return { hits: [] };
        },
      },
    });

    await useCase.execute({
      search: "ana",
      specialty: "Cardiologia",
      scope: { isGlobal: false, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: Array.from({ length: 1_000 }, (_, index) => `facility-${index}-${"x".repeat(20)}`), analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(options?.filter).toBe("specialtyNormalized = 'cardiologia'");
  });

  it("keeps professional radius filtering DB-only", async () => {
    let options: unknown;
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
      searchService: {
        isConfigured: () => true,
        search: async (_index, _query, received) => {
          options = received;
          return { hits: [] };
        },
      },
    });

    await useCase.execute({
      search: "ana",
      latitude: -23.55,
      longitude: -46.63,
      radiusKm: 5,
      scope: { isGlobal: true, assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [], territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [], managedUserIds: [], isOperationallyActive: true },
    });

    expect(options).toEqual({ limit: 20, offset: 0 });
  });

  it("does not call Meilisearch for blank professional searches", async () => {
    let searchCalls = 0;
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({ professionals: [], total: 0 })),
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
