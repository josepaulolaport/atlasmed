import { describe, expect, it, mock } from "bun:test";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { TerritoryMembershipUseCases } from "./territory-membership.use-cases";

describe("TerritoryMembershipUseCases.adminOverrideClinicTerritory", () => {
  it("republishes Meili after admin zone override", async () => {
    const setProfileTerritory = mock(async () => {});
    const onFacilityChanged = mock(async () => {});

    const uc = new TerritoryMembershipUseCases({
      territoryRepository: {
        findById: async () => ({
          id: 10,
          isActive: true,
          verticalId: 2,
          territoryType: { slug: "manager_zone", name: "Zona" },
        }),
      } as never,
      membershipService: {} as never,
      clinicWriter: {
        setProfileTerritory,
      } as never,
      onFacilityChanged,
    });

    const result = await uc.adminOverrideClinicTerritory({
      facilityId: 5,
      territoryId: 10,
    });

    expect(result).toEqual({ success: true });
    expect(setProfileTerritory).toHaveBeenCalledWith(5, 2, 10);
    expect(onFacilityChanged).toHaveBeenCalledWith(5);
  });

  it("rejects missing territory before Meili notify", async () => {
    const onFacilityChanged = mock(async () => {});
    const uc = new TerritoryMembershipUseCases({
      territoryRepository: {
        findById: async () => null,
      } as never,
      membershipService: {} as never,
      clinicWriter: {
        setProfileTerritory: mock(async () => {}),
      } as never,
      onFacilityChanged,
    });

    await expect(
      uc.adminOverrideClinicTerritory({ facilityId: 5, territoryId: 99 }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(onFacilityChanged).not.toHaveBeenCalled();
  });
});
