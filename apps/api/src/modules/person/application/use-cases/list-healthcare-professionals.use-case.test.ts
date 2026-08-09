import { describe, expect, it } from "bun:test";
import { Role, type ScopeContext } from "@atlasmed/access";
import type { HealthcareProfessionalRecord } from "../interfaces/healthcare-professional.repository.interface";
import type { HealthcareProfessionalRepository } from "../interfaces/healthcare-professional.repository.interface";
import {
  ListHealthcareProfessionalsUseCase,
  parseMeiliPersonIds,
} from "./list-healthcare-professionals.use-case";

const globalScope: ScopeContext = {
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
};

type TestSearchService = {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: {
      limit: number;
      offset: number;
      filter?: string;
      sort?: string[];
    }
  ): Promise<{ hits: T[]; estimatedTotalHits?: number }>;
};

function personRecord(id: number): HealthcareProfessionalRecord {
  return {
    id,
    firstName: "Ana",
    lastName: `Doc${id}`,
    socialName: null,
    cpf: null,
    specialty: "Ortopedia",
    facilityIds: [1],
    displayFacility: null,
    primaryRegistrationDisplay: null,
    distanceKm: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("ListHealthcareProfessionalsUseCase Meili resilience", () => {
  it("falls back to SQL on empty Meili hits", async () => {
    let findAllCalls = 0;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { professionals: [personRecord(9)], total: 1 };
        },
        findAllByIds: async () => [],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [] as unknown as T[],
          estimatedTotalHits: 0,
        }),
      } satisfies TestSearchService,
    });

    const result = await useCase.execute({
      search: "Ana",
      scope: globalScope,
    });

    expect(findAllCalls).toBe(1);
    expect(result.data.map((row) => row.id)).toEqual([9]);
  });

  it("falls back to SQL on unparseable Meili ids", async () => {
    let findAllCalls = 0;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { professionals: [personRecord(2)], total: 1 };
        },
        findAllByIds: async () => [],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [{ id: "not-a-bigint" }] as unknown as T[],
          estimatedTotalHits: 1,
        }),
      } satisfies TestSearchService,
    });

    const result = await useCase.execute({
      search: "Ana",
      scope: globalScope,
    });

    expect(findAllCalls).toBe(1);
    expect(result.data.map((row) => row.id)).toEqual([2]);
  });

  it("never drops scope when Meili filter is too large", async () => {
    let searchCalls = 0;
    let findAllCalls = 0;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async (params: {
          scope: { isGlobal: boolean; facilityIds?: number[] };
        }) => {
          findAllCalls += 1;
          expect(params.scope).toEqual({
            isGlobal: false,
            facilityIds: Array.from({ length: 2_500 }, (_, index) => index + 1),
          });
          return { professionals: [], total: 0 };
        },
        findAllByIds: async () => [],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => {
          searchCalls += 1;
          return { hits: [] as unknown as T[] };
        },
      } satisfies TestSearchService,
    });

    await useCase.execute({
      search: "Ana",
      scope: {
        ...globalScope,
        isGlobal: false,
        facilityIds: Array.from({ length: 2_500 }, (_, index) => index + 1),
      },
    });

    expect(searchCalls).toBe(0);
    expect(findAllCalls).toBe(1);
  });

  it("OR-filters multiple specialties in Meili", async () => {
    let filter: string | undefined;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async () => ({ professionals: [], total: 0 }),
        findAllByIds: async () => [personRecord(1)],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>(
          _index: string,
          _query: string,
          options: { filter?: string }
        ) => {
          filter = options.filter;
          return {
            hits: [{ id: 1 }] as unknown as T[],
            estimatedTotalHits: 1,
          };
        },
      } satisfies TestSearchService,
    });

    await useCase.execute({
      search: "Ana",
      specialty: "Cardiologia,Pediatria",
      scope: globalScope,
    });

    expect(filter).toContain(
      "(specialtyNormalized = 'cardiologia' OR specialtyNormalized = 'pediatria')"
    );
  });

  it("falls back to SQL when hydrate drops Meili hits", async () => {
    let findAllCalls = 0;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async () => {
          findAllCalls += 1;
          return { professionals: [personRecord(8)], total: 1 };
        },
        findAllByIds: async () => [personRecord(2)],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>() => ({
          hits: [{ id: 1 }, { id: 2 }] as unknown as T[],
          estimatedTotalHits: 2,
        }),
      } satisfies TestSearchService,
    });

    const result = await useCase.execute({
      search: "Ana",
      scope: globalScope,
    });

    expect(findAllCalls).toBe(1);
    expect(result.data.map((row) => row.id)).toEqual([8]);
  });

  it("uses compact MANAGER Meili scope (activeTerritoryIds)", async () => {
    let filter: string | undefined;
    const useCase = new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository: {
        findAll: async () => ({ professionals: [], total: 0 }),
        findAllByIds: async () => [],
      } as unknown as HealthcareProfessionalRepository,
      searchService: {
        isConfigured: () => true,
        search: async <T extends Record<string, unknown>>(
          _index: string,
          _query: string,
          options: { filter?: string }
        ) => {
          filter = options.filter;
          return { hits: [] as unknown as T[] };
        },
      } satisfies TestSearchService,
    });

    await useCase.execute({
      search: "Ana",
      role: Role.MANAGER,
      scope: {
        ...globalScope,
        isGlobal: false,
        oversightZoneIds: [4, 2],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
      },
    });

    expect(filter).toBe("activeTerritoryIds IN [2, 4]");
  });
});

describe("parseMeiliPersonIds", () => {
  it("keeps only CRM bigint ids", () => {
    expect(
      parseMeiliPersonIds([
        { id: 1 },
        { id: "2" },
        { id: "uuid-legacy" },
        { id: "3.0" },
      ])
    ).toEqual([1, 2]);
  });
});
