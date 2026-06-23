import { describe, expect, it, mock } from "bun:test";
import { TerritoryClosureService } from "./territory-closure.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";

describe("TerritoryClosureService", () => {
  it("rebuilds closure rows for a subtree", async () => {
    const territories = new Map([
      [
        "root",
        {
          id: "root",
          name: "Brazil",
          code: "BR",
          nodeType: "root" as const,
          regionSlug: null,
          stateCode: null,
          parentId: null,
          isActive: true,
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
          code: "BR-SE",
          nodeType: "region" as const,
          regionSlug: "SE",
          stateCode: null,
          parentId: "root",
          isActive: true,
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
          code: "BR-SE-01",
          nodeType: "patch" as const,
          regionSlug: "SE",
          stateCode: null,
          parentId: "region",
          isActive: true,
          organizationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);

    const territoryRepository: TerritoryRepository = {
      findById: mock(async (id: string) => territories.get(id) ?? null),
      findByCode: mock(async () => null),
      findAllActive: mock(async () => [...territories.values()]),
      findChildren: mock(async (parentId: string) =>
        [...territories.values()].filter((t) => t.parentId === parentId)
      ),
      countActiveChildren: mock(async () => 0),
      countClinics: mock(async () => 0),
      countAssignedUsers: mock(async () => 0),
      countPatchesUnderParent: mock(async () => 0),
      create: mock(async () => {
        throw new Error("not implemented");
      }),
      update: mock(async () => {
        throw new Error("not implemented");
      }),
      findActiveRoot: mock(async () => territories.get("root") ?? null),
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
      ancestorId: "root",
      descendantId: "patch",
      depth: 2,
    });
  });
});
