import { describe, expect, it, mock } from "bun:test";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";

describe("TerritoryClosureService", () => {
  it("rebuilds closure rows for a subtree", async () => {
    const territories = new Map([
      [
        "br",
        {
          id: "br",
          name: "Brazil",
          slug: "br",
          code: "BR",
          nodeType: "region" as const,
          territoryTypeId: "tt_country",
          countryCode: "BR",
          regionSlug: "BR",
          stateCode: null,
          parentId: null,
          isActive: true,
          parentAssignmentStatus: "resolved" as const,
          parentAssignmentSource: "inferred" as const,
          organizationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        "region",
        {
          id: "region",
          name: "Sudeste",
          slug: "sudeste",
          code: "SUDESTE",
          nodeType: "region" as const,
          territoryTypeId: "tt_region",
          countryCode: "BR",
          regionSlug: "SE",
          stateCode: null,
          parentId: "br",
          isActive: true,
          parentAssignmentStatus: "resolved" as const,
          parentAssignmentSource: "geo" as const,
          organizationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        "patch",
        {
          id: "patch",
          name: "Patch 1",
          slug: "patch-01",
          code: "PATCH-01",
          nodeType: "patch" as const,
          territoryTypeId: "tt_patch",
          countryCode: "BR",
          regionSlug: "SE",
          stateCode: null,
          parentId: "region",
          isActive: true,
          parentAssignmentStatus: "resolved" as const,
          parentAssignmentSource: "geo" as const,
          organizationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);

    const territoryRepository: TerritoryRepository = {
      findById: mock(async (id: string) => territories.get(id) ?? null),
      findBySlug: mock(async () => null),
      findByCode: mock(async () => null),
      findAllActive: mock(async () => [...territories.values()]),
      findChildren: mock(async (parentId: string) =>
        [...territories.values()].filter((t) => t.parentId === parentId)
      ),
      countActiveChildren: mock(async () => 0),
      countClinics: mock(async () => 0),
      countAssignedUsers: mock(async () => 0),
      create: mock(async () => {
        throw new Error("not implemented");
      }),
      update: mock(async () => {
        throw new Error("not implemented");
      }),
      findActiveCountryByCode: mock(async () => territories.get("br") ?? null),
      findAmbiguousParentAssignments: mock(async () => []),
    };

    const insertedRows: Array<{
      ancestorId: string;
      descendantId: string;
      depth: number;
    }> = [];

    const closureRepository: TerritoryClosureRepository = {
      deleteForDescendants: mock(async () => undefined),
      insertRows: mock(async (rows) => {
        insertedRows.push(...rows);
      }),
      findDescendantIds: mock(async () => []),
      findAncestorIds: mock(async () => []),
      hasAncestorDescendantRelation: mock(async () => false),
    };

    const { TerritoryClosureService } = await import("./territory-closure.service");
    const service = new TerritoryClosureService({
      territoryRepository,
      closureRepository,
    });

    await service.rebuildSubtree("region");

    expect(insertedRows).toContainEqual({
      ancestorId: "region",
      descendantId: "region",
      depth: 0,
    });
    expect(insertedRows).toContainEqual({
      ancestorId: "region",
      descendantId: "patch",
      depth: 1,
    });
    expect(insertedRows).toContainEqual({
      ancestorId: "br",
      descendantId: "patch",
      depth: 2,
    });
  });
});
