import { describe, expect, it, mock } from "bun:test";
import { TerritoryGeoParentService } from "./territory-geo-parent.service";

describe("TerritoryGeoParentService", () => {
  it("picks clear primary parent and secondary rollups from geo overlap", async () => {
    const territory = {
      id: "sp",
      name: "São Paulo",
      slug: "sp",
      code: "SP",
      nodeType: "state" as const,
      territoryTypeId: "tt_state",
      territoryType: {
        id: "tt_state",
        slug: "state",
        name: "State",
        description: null,
        canHaveBoundary: true,
        assignsClinics: false,
        assignableToUsers: false,
        assignableToManagers: true,
        isCountryLevel: false,
        blockSiblingOverlap: false,
        sortOrder: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      countryCode: "BR",
      regionSlug: null,
      stateCode: null,
      parentId: null,
      isActive: true,
      parentAssignmentStatus: "ambiguous" as const,
      parentAssignmentSource: null,
      organizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new TerritoryGeoParentService({
      territoryRepository: {
        findById: mock(async (id: string) =>
          id === "sudeste"
            ? {
                ...territory,
                id: "sudeste",
                slug: "sudeste",
                code: "SUDESTE",
                parentId: "br",
              }
            : null
        ),
        update: mock(async (_id, data) => ({ ...territory, ...data })),
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => territory.territoryType),
      } as never,
      closureRepository: {
        findDescendantIds: mock(async () => ["sp"]),
        findAncestorIds: mock(async () => []),
      } as never,
      spatialRepository: {
        scoreParentCandidates: mock(async () => [
          { id: "sudeste", code: "SUDESTE", overlapRatio: 0.95 },
          { id: "sul", code: "SUL", overlapRatio: 0.12 },
        ]),
      } as never,
      rollupRepository: {
        replaceGeoRollupLinks: mock(async () => {}),
      } as never,
    });

    const resolution = await service.resolveParentFromBoundary(territory, {
      type: "Polygon",
      coordinates: [],
    });

    expect(resolution.primaryParentId).toBe("sudeste");
    expect(resolution.rollupAncestorIds).toEqual(["sul"]);
    expect(resolution.parentAssignmentStatus).toBe("resolved");
  });
});
