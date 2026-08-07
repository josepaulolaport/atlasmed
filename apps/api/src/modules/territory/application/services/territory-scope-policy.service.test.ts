import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  assertManagerTerritoryApprovalRequest,
  assertTerritorialJurisdiction,
  isInTerritorialJurisdiction,
} from "./territory-scope-policy.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

const PATCH_IN_SCOPE = 1;
const OTHER_PATCH = 2;

const scopedManager: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [PATCH_IN_SCOPE],
  analyticsEffectiveTerritoryIds: [PATCH_IN_SCOPE],
  territoryIds: [PATCH_IN_SCOPE],
  facilityIds: [1],
  analyticsFacilityIds: [1],
  clinicIds: [1],
  analyticsClinicIds: [1],
  managedUserIds: [1],
  isOperationallyActive: true,
};

function createTerritoryRepository(
  overrides: Partial<TerritoryRepository> = {}
): TerritoryRepository {
  return {
    findById: mock(async (id: number) =>
      id === PATCH_IN_SCOPE
        ? {
            id,
            name: "Patch",
            slug: "patch",
            code: "PATCH",
            verticalId: 1,
            territoryTypeId: 1,
            managerTerritoryId: 50,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : null
    ),
    ...overrides,
  } as unknown as TerritoryRepository;
}

describe("TerritoryScopePolicyService", () => {
  it("checks territorial jurisdiction", () => {
    expect(isInTerritorialJurisdiction(scopedManager, PATCH_IN_SCOPE)).toBe(
      true
    );
    expect(isInTerritorialJurisdiction(scopedManager, OTHER_PATCH)).toBe(false);
  });

  it("allows manager to deactivate a territory in their jurisdiction", async () => {
    await assertManagerTerritoryApprovalRequest({
      scope: scopedManager,
      territoryRepository: createTerritoryRepository(),
      type: "deactivate_territory",
      targetTerritoryId: PATCH_IN_SCOPE,
    });
  });

  it("rejects manager deactivate on a territory outside their jurisdiction", async () => {
    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        type: "deactivate_territory",
        targetTerritoryId: OTHER_PATCH,
      })
    ).rejects.toThrow("outside your territorial jurisdiction");
  });

  it("skips jurisdiction checks for global scope", () => {
    expect(() =>
      assertTerritorialJurisdiction(
        { isGlobal: true, effectiveTerritoryIds: [] },
        999,
        "test"
      )
    ).not.toThrow();
  });
});
