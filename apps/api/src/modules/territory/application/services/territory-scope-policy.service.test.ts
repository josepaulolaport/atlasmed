import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  assertManagerTerritoryApprovalRequest,
  assertTerritorialJurisdiction,
  isInTerritorialJurisdiction,
} from "./territory-scope-policy.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

const scopedManager: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: ["patch-in-scope"],
  analyticsEffectiveTerritoryIds: ["patch-in-scope"],
  territoryIds: ["patch-in-scope"],
  facilityIds: ["facility-1"],
  analyticsFacilityIds: ["facility-1"],
  clinicIds: ["facility-1"],
  analyticsClinicIds: ["facility-1"],
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
            territoryTypeId: "tt_patch",
            managerTerritoryId: "manager-zone-1",
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
    expect(isInTerritorialJurisdiction(scopedManager, "patch-in-scope")).toBe(
      true
    );
    expect(isInTerritorialJurisdiction(scopedManager, "other-patch")).toBe(false);
  });

  it("allows manager to deactivate a territory in their jurisdiction", async () => {
    await assertManagerTerritoryApprovalRequest({
      scope: scopedManager,
      territoryRepository: createTerritoryRepository(),
      type: "deactivate_territory",
      targetTerritoryId: "patch-in-scope",
    });
  });

  it("rejects manager deactivate on a territory outside their jurisdiction", async () => {
    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        type: "deactivate_territory",
        targetTerritoryId: "other-patch",
      })
    ).rejects.toThrow("outside your territorial jurisdiction");
  });

  it("rejects facility move when facility is out of scope", async () => {
    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        type: "clinic_territory_change",
        facilityId: "facility-out",
        toTerritoryId: "patch-in-scope",
      })
    ).rejects.toThrow("Facility is outside your scope");
  });

  it("rejects facility move when target territory is outside jurisdiction", async () => {
    await expect(
      assertManagerTerritoryApprovalRequest({
        scope: scopedManager,
        territoryRepository: createTerritoryRepository(),
        type: "clinic_territory_change",
        facilityId: "facility-1",
        toTerritoryId: "other-patch",
      })
    ).rejects.toThrow("outside your territorial jurisdiction");
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
