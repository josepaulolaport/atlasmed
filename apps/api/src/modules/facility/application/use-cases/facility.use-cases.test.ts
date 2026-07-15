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
      scope: { isGlobal: true, facilityIds: [], territoryIds: [] },
    });

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 27,
      totalPages: 3,
    });
  });

  it("passes scoped facility ids to the repository", async () => {
    let receivedScope: unknown;
    const scope: ScopeContext = {
      isGlobal: false,
      facilityIds: ["facility-1"],
      territoryIds: ["territory-1"],
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
});
