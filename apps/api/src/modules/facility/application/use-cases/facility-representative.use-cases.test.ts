import { describe, expect, it } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListFacilityRepresentativesUseCase } from "./facility-representative.use-cases";
import type {
  FacilityRepresentativeRecord,
  FacilityRepresentativeRepository,
} from "../interfaces/facility-representative.repository.interface";

const now = new Date("2026-01-15T12:00:00.000Z");

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

function representative(
  overrides: Partial<FacilityRepresentativeRecord> = {}
): FacilityRepresentativeRecord {
  return {
    id: "rep-1",
    facilityId: "facility-1",
    representativeName: "Maria Souza",
    roleTitle: "Compradora",
    email: "maria@example.com",
    phone: "11999998888",
    taxId: null,
    contactType: "COMPRADOR",
    sourceProvider: null,
    externalSourceKey: null,
    sourceActive: true,
    confirmedAt: now,
    confirmedByUserId: "user-1",
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ListFacilityRepresentativesUseCase", () => {
  it("serializes active representatives with pagination", async () => {
    const repository: FacilityRepresentativeRepository = {
      findByFacilityAndExternalKey: async () => null,
      findActiveByFacility: async () => ({
        items: [representative()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      upsertFromRegistry: async () => representative(),
      confirm: async () => representative(),
      createManual: async () => representative(),
      endSourceRepresentative: async () => null,
    };

    const result = await new ListFacilityRepresentativesUseCase({
      facilityRepresentativeRepository: repository,
    }).execute({
      facilityId: "facility-1",
      scope: globalScope,
    });

    expect(result.data).toEqual([
      {
        id: "rep-1",
        facilityId: "facility-1",
        representativeName: "Maria Souza",
        roleTitle: "Compradora",
        email: "maria@example.com",
        phone: "11999998888",
        taxId: null,
        contactType: "COMPRADOR",
        sourceProvider: null,
        confirmedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("denies facilities outside scope", async () => {
    const useCase = new ListFacilityRepresentativesUseCase({
      facilityRepresentativeRepository: {
        findByFacilityAndExternalKey: async () => null,
        findActiveByFacility: async () => {
          throw new Error("should not query");
        },
        upsertFromRegistry: async () => representative(),
        confirm: async () => representative(),
        createManual: async () => representative(),
        endSourceRepresentative: async () => null,
      },
    });

    await expect(
      useCase.execute({
        facilityId: "facility-out",
        scope: {
          ...globalScope,
          isGlobal: false,
          facilityIds: ["facility-1"],
          clinicIds: ["facility-1"],
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
