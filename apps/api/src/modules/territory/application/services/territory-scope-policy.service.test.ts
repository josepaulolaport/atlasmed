import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  assertManagerTerritoryApprovalRequest,
  assertTerritorialJurisdiction,
  isInTerritorialJurisdiction,
  isTerritoryLeaf,
  resolveReadableTerritoryIds,
} from "./territory-scope-policy.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";

const scopedManager: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: ["patch-in-scope"],
  analyticsEffectiveTerritoryIds: ["patch-in-scope"],
  territoryIds: ["patch-in-scope"],
  facilityIds: ["facility-1"],
  analyticsFacilityIds: ["facility-1"],
  managedUserIds: ["user-1"],
  isOperationallyActive: true,
};

function createTerritoryRepository(
  overrides: Partial<TerritoryRepository> = {}
): TerritoryRepository {
  return {
    findById: mock(async (id: string) =>
      id === "patch-in-scope"
        ? {
            id,
            name: "Patch",
            slug: "patch",
            code: "PATCH",
            nodeType: "patch",
            territoryTypeId: "tt_patch",
            countryCode: "BR",
            regionSlug: null,
            stateCode: null,
            parentId: "region-1",
            isActive: true,
            parentAssignmentStatus: "resolved",
            parentAssignmentSource: "manual",
            organizationId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : null
    ),
    countActiveChildren: mock(async () => 0),
    ...overrides,
  } as unknown as TerritoryRepository;
}

describe("TerritoryScopePolicyService", () => {
  it("identifies leaf territories", () => {
    expect(isTerritoryLeaf(0)).toBe(true);
    expect(isTerritoryLeaf(1)).toBe(false);
  });

  it("checks territorial jurisdiction", () => {
    expect(isInTerritorialJurisdiction(scopedManager, "patch-in-scope")).toBe(
      true
    );
    expect(isInTerritorialJurisdiction(scopedManager, "other-patch")).toBe(false);
  });

  it("resolves readable ids with ancestors", async () => {
    const closureRepository = {
      findAncestorIds: mock(async () => ["region-1", "country-1"]),
    } as unknown as TerritoryClosureRepository;

    const readable = await resolveReadableTerritoryIds(
      scopedManager,
      closureRepository
    );

    expect(readable).toEqual(
      new Set(["patch-in-scope", "region-1", "country-1"])
    );
  });

  it("allows manager create when parent is in readable scope", async () => {
    const closureRepository = {
      findAncestorIds: mock(async () => ["region-1"]),
    } as unknown as TerritoryClosureRepository;

    await assertManagerTerritoryApprovalRequest({
      scope: scopedManager,
      territoryRepository: createTerritoryRepository(),
      closureRepository,
      type: "create_territory",
      entityPayload: { parentId: "region-1" },
    });
  });

  it("rejects manager create when parent is outside readable scope", async () => {
    const closureRepository = {
      findAncestorIds: mock(async () => []),
    } as unknown as TerritoryClosureRepository;

    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        closureRepository,
        type: "create_territory",
        entityPayload: { parentId: "other-region" },
      })
    ).rejects.toThrow("outside your readable scope");
  });

  it("rejects manager deactivate on non-leaf territory", async () => {
    const territoryRepository = createTerritoryRepository({
      countActiveChildren: mock(async () => 2),
    });

    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository,
        closureRepository: { findAncestorIds: mock(async () => []) } as unknown as TerritoryClosureRepository,
        type: "deactivate_territory",
        targetTerritoryId: "patch-in-scope",
      })
    ).rejects.toThrow("Only leaf territories");
  });

  it("rejects facility move when facility is out of scope", async () => {
    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        closureRepository: { findAncestorIds: mock(async () => []) } as unknown as TerritoryClosureRepository,
        type: "facility_territory_change",
        facilityId: "facility-out",
        toTerritoryId: "patch-in-scope",
      })
    ).rejects.toThrow("Facility is outside your scope");
  });

  it("skips jurisdiction checks for global scope", () => {
    expect(() =>
      assertTerritorialJurisdiction(
        { isGlobal: true, effectiveTerritoryIds: [] },
        "any",
        "test"
      )
    ).not.toThrow();
  });
});
