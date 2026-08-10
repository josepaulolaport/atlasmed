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

    const bounds = {
      south: -23.7,
      west: -46.8,
      north: -23.4,
      east: -46.5,
    };
    const result = await useCase.execute({
      scope: createGlobalScopeContext(),
      role: "ADMIN",
      bounds,
    });

    expect(listMapPoints).toHaveBeenCalledWith(
      {
        isGlobal: true,
        verticalIds: [],
        restrictToVerticalProfiles: false,
      },
      bounds,
    );
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

  it("rejects inverted latitude bounds before querying", async () => {
    const listMapPoints = mock(async () => []);
    const useCase = new ListMapFacilityPointsUseCase({
      facilityRepository: fakeRepo(listMapPoints),
    });

    await expect(
      useCase.execute({
        scope: createGlobalScopeContext(),
        role: "ADMIN",
        bounds: {
          south: -23.4,
          west: -46.8,
          north: -23.7,
          east: -46.5,
        },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(listMapPoints).not.toHaveBeenCalled();
  });

  it("keeps the legacy unbounded query compatible", async () => {
    const listMapPoints = mock(async () => []);
    const useCase = new ListMapFacilityPointsUseCase({
      facilityRepository: fakeRepo(listMapPoints),
    });

    await useCase.execute({
      scope: createGlobalScopeContext(),
      role: "ADMIN",
    });

    expect(listMapPoints).toHaveBeenCalledWith(
      {
        isGlobal: true,
        verticalIds: [],
        restrictToVerticalProfiles: false,
      },
      undefined,
    );
  });

  it("passes restricted scope for non-admin roles", async () => {
    const listMapPoints = mock(async () => []);
    const useCase = new ListMapFacilityPointsUseCase({
      facilityRepository: fakeRepo(listMapPoints),
    });

    const bounds = {
      south: -23.7,
      west: -46.8,
      north: -23.4,
      east: -46.5,
    };
    await useCase.execute({
      scope: {
        ...createEmptyScopeContext(),
        facilityIds: [1, 2],
        assignedVerticalIds: [1],
      },
      role: "REP",
      verticalId: 1,
      bounds,
    });

    expect(listMapPoints).toHaveBeenCalledWith(
      {
        isGlobal: false,
        facilityIds: [1, 2],
        verticalIds: [1],
        restrictToVerticalProfiles: true,
      },
      bounds,
    );
  });
});
