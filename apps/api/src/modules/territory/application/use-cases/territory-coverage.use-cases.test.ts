import { describe, expect, it, mock } from "bun:test";
import { TerritoryCoverageUseCases } from "./territory-coverage.use-cases";
import { OperationNotAllowedError, ResourceNotFoundError } from "../../../../shared/errors";

const globalScope = { isGlobal: true } as never;

const spReference = {
  id: "sp",
  name: "São Paulo",
  slug: "sao-paulo",
  code: "BR-UF-SP",
  territoryTypeId: "tt_state",
  territoryType: { id: "tt_state", slug: "state", name: "State" },
};

const spBoundary = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-48, -24],
      [-44, -24],
      [-44, -20],
      [-48, -20],
      [-48, -24],
    ],
  ],
};

describe("TerritoryCoverageUseCases", () => {
  it("returns reference boundary, clipped patches, and clinics grouped by patch", async () => {
    const getBoundaryAsGeoJson = mock(async () => spBoundary);
    const listByReferenceTerritoryId = mock(async () => [
      {
        id: "m-1",
        operationalTerritoryId: "patch-1",
        referenceTerritoryId: "sp",
        referenceTypeSlug: "state",
        overlapRatio: 0.62,
        intersectionAreaSqKm: 1200,
        computedAt: new Date("2026-06-19T12:00:00Z"),
        operationalTerritory: {
          id: "patch-1",
          name: "Patch 1",
          slug: "patch-1",
          code: "PATCH-1",
          territoryType: { slug: "patch", name: "Patch" },
        },
      },
      {
        id: "m-2",
        operationalTerritoryId: "patch-2",
        referenceTerritoryId: "sp",
        referenceTypeSlug: "state",
        overlapRatio: 0.31,
        intersectionAreaSqKm: 600,
        computedAt: new Date("2026-06-19T12:00:00Z"),
        operationalTerritory: {
          id: "patch-2",
          name: "Patch 2",
          slug: "patch-2",
          code: "PATCH-2",
          territoryType: { slug: "patch", name: "Patch" },
        },
      },
    ]);
    const findAssignedClinicsInReferenceTerritory = mock(async () => [
      {
        id: "clinic-1",
        name: "Facility A",
        lat: -23.5,
        lng: -46.6,
        territoryId: "patch-1",
        operationalTerritoryCode: "PATCH-1",
        operationalTerritoryName: "Patch 1",
      },
      {
        id: "clinic-2",
        name: "Facility B",
        lat: -23.6,
        lng: -46.7,
        territoryId: "patch-1",
        operationalTerritoryCode: "PATCH-1",
        operationalTerritoryName: "Patch 1",
      },
      {
        id: "clinic-3",
        name: "Facility C",
        lat: -22.9,
        lng: -47.1,
        territoryId: "patch-2",
        operationalTerritoryCode: "PATCH-2",
        operationalTerritoryName: "Patch 2",
      },
    ]);
    const getClippedBoundaryAsGeoJson = mock(
      async (operationalId: string, _referenceId: string) => ({
        type: "Polygon" as const,
        coordinates: [
          [
            [-47, -23],
            [-46, -23],
            [-46, -22],
            [-47, -22],
            [-47, -23],
          ],
        ],
        operationalId,
      })
    );

    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async () => spReference),
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => ({ id: "tt_state", slug: "state" })),
      } as never,
      geoMembershipRepository: {
        listByReferenceTerritoryId,
      } as never,
      spatialRepository: {
        getBoundaryAsGeoJson,
        findAssignedClinicsInReferenceTerritory,
        getClippedBoundaryAsGeoJson,
      } as never,
    });

    const result = await useCases.getReferenceCoverage({
      referenceTerritoryId: "sp",
      scope: globalScope,
    });

    expect(result.reference).toEqual({
      id: "sp",
      name: "São Paulo",
      slug: "sao-paulo",
      code: "BR-UF-SP",
      boundary: spBoundary,
    });
    expect(result.clinicCount).toBe(3);
    expect(result.patchCount).toBe(2);
    expect(result.patches).toHaveLength(2);
    expect(result.patches[0]?.facilities).toHaveLength(2);
    expect(result.patches[1]?.facilities).toHaveLength(1);
    expect(getClippedBoundaryAsGeoJson).toHaveBeenCalledTimes(2);
    expect(findAssignedClinicsInReferenceTerritory).toHaveBeenCalledWith("sp");
  });

  it("rejects coverage view for non-reference territory types", async () => {
    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async () => ({
          id: "patch-1",
          territoryTypeId: "tt_patch",
          territoryType: { id: "tt_patch", slug: "patch" },
        })),
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => ({ id: "tt_patch", slug: "patch" })),
      } as never,
      geoMembershipRepository: {} as never,
      spatialRepository: {} as never,
    });

    await expect(
      useCases.getReferenceCoverage({ referenceTerritoryId: "patch-1", scope: globalScope })
    ).rejects.toThrow(OperationNotAllowedError);
  });

  it("throws when reference territory is not found", async () => {
    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async () => null),
      } as never,
      territoryTypeRepository: {} as never,
      geoMembershipRepository: {} as never,
      spatialRepository: {} as never,
    });

    await expect(
      useCases.getReferenceCoverage({ referenceTerritoryId: "missing", scope: globalScope })
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
