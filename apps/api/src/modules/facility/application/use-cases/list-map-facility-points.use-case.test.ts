import { describe, expect, it, mock } from "bun:test";
import { createEmptyScopeContext, createGlobalScopeContext } from "@atlasmed/access";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { ListMapFacilityPointsUseCase } from "./list-map-facility-points.use-case";

function fakeRepo(
  listMapPoints: FacilityRepository["listMapPoints"]
): FacilityRepository {
  return {
    listMapPoints,
  } as unknown as FacilityRepository;
}

describe("ListMapFacilityPointsUseCase", () => {
  it("returns GeoJSON FeatureCollection of thin points", async () => {
    const listMapPoints = mock(async () => [
      {
        id: 1,
        name: "Clinic A",
        lat: -23.5,
        lng: -46.6,
        purchaseBucket: "active" as const,
      },
      {
        id: 2,
        name: "Clinic B",
        lat: -23.6,
        lng: -46.7,
        purchaseBucket: "neverBought" as const,
      },
    ]);
    const useCase = new ListMapFacilityPointsUseCase({
      facilityRepository: fakeRepo(listMapPoints),
    });

    const result = await useCase.execute({
      scope: createGlobalScopeContext(),
      role: "ADMIN",
    });

    expect(listMapPoints).toHaveBeenCalledTimes(1);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-46.6, -23.5] },
      properties: {
        facilityId: 1,
        name: "Clinic A",
        purchaseBucket: "active",
      },
    });
  });

  it("passes restricted scope for non-admin roles", async () => {
    const listMapPoints = mock(async () => []);
    const useCase = new ListMapFacilityPointsUseCase({
      facilityRepository: fakeRepo(listMapPoints),
    });

    await useCase.execute({
      scope: {
        ...createEmptyScopeContext(),
        facilityIds: [1, 2],
        assignedVerticalIds: [1],
      },
      role: "REP",
      verticalId: 1,
    });

    expect(listMapPoints).toHaveBeenCalledWith({
      isGlobal: false,
      facilityIds: [1, 2],
      verticalIds: [1],
      restrictToVerticalProfiles: true,
    });
  });
});
