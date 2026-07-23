import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  CreateFacilityRepresentativeUseCase,
  ListFacilityRepresentativesUseCase,
  UpdateFacilityRepresentativeUseCase,
} from "./facility-representative.use-cases";
import type {
  FacilityRepresentativeRecord,
  FacilityRepresentativeRepository,
} from "../interfaces/facility-representative.repository.interface";
import type { UserRepresentativeRelationshipRepository } from "../interfaces/user-representative-relationship.repository.interface";

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
    isPartner: false,
    isAdministrator: false,
    isDecisionMaker: false,
    isBuyer: true,
    isBiller: false,
    isSecretary: false,
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

function stubRepo(
  overrides: Partial<FacilityRepresentativeRepository> = {}
): FacilityRepresentativeRepository {
  return {
    findByFacilityAndExternalKey: async () => null,
    findByIdForFacility: async () => representative(),
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
    updateManual: async () => representative(),
    endSourceRepresentative: async () => null,
    ...overrides,
  };
}

function stubRelRepo(
  levels: Map<string, number> = new Map()
): UserRepresentativeRelationshipRepository {
  return {
    findByUserAndRepresentative: async (_userId, representativeId) => {
      const level = levels.get(representativeId);
      if (level === undefined) return null;
      return {
        id: "urr-1",
        userId: "user-1",
        representativeId,
        relationshipLevel: level,
        createdAt: now,
        updatedAt: now,
      };
    },
    findLevelsByUserAndRepresentatives: async () => levels,
    upsert: async ({ userId, representativeId, relationshipLevel }) => {
      levels.set(representativeId, relationshipLevel);
      return {
        id: "urr-1",
        userId,
        representativeId,
        relationshipLevel,
        createdAt: now,
        updatedAt: now,
      };
    },
    deleteByUserAndRepresentative: async (_userId, representativeId) => {
      levels.delete(representativeId);
    },
  };
}

describe("ListFacilityRepresentativesUseCase", () => {
  it("serializes active representatives with roles and relationship", async () => {
    const levels = new Map([["rep-1", 6]]);
    const result = await new ListFacilityRepresentativesUseCase({
      facilityRepresentativeRepository: stubRepo(),
      userRepresentativeRelationshipRepository: stubRelRepo(levels),
    }).execute({
      facilityId: "facility-1",
      scope: globalScope,
      userId: "user-1",
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
        isPartner: false,
        isAdministrator: false,
        isDecisionMaker: false,
        isBuyer: true,
        isBiller: false,
        isSecretary: false,
        relationshipLevel: 6,
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
      facilityRepresentativeRepository: stubRepo({
        findActiveByFacility: async () => {
          throw new Error("should not query");
        },
      }),
      userRepresentativeRelationshipRepository: stubRelRepo(),
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
        userId: "user-1",
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("CreateFacilityRepresentativeUseCase", () => {
  it("passes role flags to createManual", async () => {
    const createManual = mock(async () =>
      representative({ isDecisionMaker: true, isBuyer: false, contactType: "DECISOR" })
    );
    const result = await new CreateFacilityRepresentativeUseCase({
      facilityRepresentativeRepository: stubRepo({ createManual }),
      userRepresentativeRelationshipRepository: stubRelRepo(),
    }).execute({
      facilityId: "facility-1",
      scope: globalScope,
      userId: "user-1",
      representativeName: "Ana",
      isDecisionMaker: true,
      isSecretary: true,
    });

    expect(createManual).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: { isDecisionMaker: true, isSecretary: true },
      })
    );
    expect(result.isDecisionMaker).toBe(true);
  });
});

describe("UpdateFacilityRepresentativeUseCase", () => {
  it("upserts relationship level for the authenticated user", async () => {
    const levels = new Map<string, number>();
    const result = await new UpdateFacilityRepresentativeUseCase({
      facilityRepresentativeRepository: stubRepo(),
      userRepresentativeRelationshipRepository: stubRelRepo(levels),
    }).execute({
      facilityId: "facility-1",
      representativeId: "rep-1",
      scope: globalScope,
      userId: "user-1",
      relationshipLevel: 8,
      isBiller: true,
    });

    expect(result.relationshipLevel).toBe(8);
    expect(levels.get("rep-1")).toBe(8);
  });

  it("clears relationship when null", async () => {
    const levels = new Map([["rep-1", 4]]);
    const result = await new UpdateFacilityRepresentativeUseCase({
      facilityRepresentativeRepository: stubRepo(),
      userRepresentativeRelationshipRepository: stubRelRepo(levels),
    }).execute({
      facilityId: "facility-1",
      representativeId: "rep-1",
      scope: globalScope,
      userId: "user-1",
      relationshipLevel: null,
    });

    expect(result.relationshipLevel).toBeUndefined();
    expect(levels.has("rep-1")).toBe(false);
  });
});
