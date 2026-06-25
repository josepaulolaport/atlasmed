import { describe, expect, it, mock } from "bun:test";
import { TerritoryGeoMembershipService } from "./territory-geo-membership.service";

describe("TerritoryGeoMembershipService", () => {
  it("rebuilds membership rows for operational territories", async () => {
    const deleteForOperationalTerritory = mock(async () => {});
    const insertRows = mock(async () => {});
    const update = mock(async (_id: string, data: Record<string, unknown>) => ({
      id: "patch-1",
      ...data,
    }));

    const service = new TerritoryGeoMembershipService({
      territoryRepository: {
        findById: mock(async () => ({
          id: "patch-1",
          territoryTypeId: "tt_patch",
          territoryType: {
            id: "tt_patch",
            slug: "patch",
            assignsClinics: true,
          },
          countryCode: "BR",
        })),
        update,
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => ({
          id: "tt_patch",
          slug: "patch",
          assignsClinics: true,
        })),
      } as never,
      geoMembershipRepository: {
        computeCandidates: mock(async () => [
          {
            referenceTerritoryId: "sp",
            referenceTypeSlug: "state",
            overlapRatio: 0.62,
            intersectionAreaSqKm: 1200,
          },
          {
            referenceTerritoryId: "mun-1",
            referenceTypeSlug: "intermediate",
            overlapRatio: 0.4,
            intersectionAreaSqKm: 800,
          },
        ]),
        deleteForOperationalTerritory,
        insertRows,
      } as never,
    });

    const result = await service.rebuildForOperationalTerritory("patch-1");

    expect(deleteForOperationalTerritory).toHaveBeenCalledWith("patch-1");
    expect(insertRows).toHaveBeenCalledTimes(1);
    expect(result.membershipCount).toBe(2);
    expect(result.referenceTerritoryIds).toEqual(["sp", "mun-1"]);
  });
});
