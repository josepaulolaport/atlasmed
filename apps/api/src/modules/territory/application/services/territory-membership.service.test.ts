import { describe, expect, it, mock } from "bun:test";
import { TerritoryMembershipService } from "./territory-membership.service";
import type { ClinicMembershipTarget } from "./territory-membership.service";

const CLINIC_ID = 1;
const LEAF_TERRITORY_ID = 1;
const REMOVED_TERRITORY_ID = 99;
const ZONE_TERRITORY_ID = 1;

function createClinicWriter(overrides: Record<string, unknown> = {}) {
  return {
    updateProfileTerritoryMemberships: mock(async () => {}),
    setProfileTerritory: mock(async () => {}),
    findClinicsForMembership: mock(async () => []),
    findClinicsWithoutConsultant: mock(async () => []),
    ...overrides,
  };
}

describe("TerritoryMembershipService", () => {
  it("assigns clinic to a single matching leaf territory", async () => {
    const clinicWriter = createClinicWriter();

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => [
          { id: LEAF_TERRITORY_ID, verticalId: 1 },
        ]),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo({
      id: CLINIC_ID,
      lat: -23.5,
      lng: -46.6,
      managerZoneId: null,
    });

    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledWith(CLINIC_ID, [
      { verticalId: 1, managerZoneId: LEAF_TERRITORY_ID },
    ]);
  });

  it("updates profiles per vertical and clears ambiguous vertical matches", async () => {
    const clinicWriter = createClinicWriter();

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => [
          { id: 1, verticalId: 1 },
          { id: 2, verticalId: 1 },
          { id: 20, verticalId: 20 },
        ]),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo({
      id: CLINIC_ID,
      lat: -23.5,
      lng: -46.6,
      managerZoneId: null,
    });

    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledWith(CLINIC_ID, [
      { verticalId: 20, managerZoneId: 20 },
    ]);
  });

  it("clears profile zones when clinic has no coordinates", async () => {
    const clinicWriter = createClinicWriter();

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => []),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo({
      id: CLINIC_ID,
      lat: null,
      lng: null,
      managerZoneId: ZONE_TERRITORY_ID,
    });

    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledWith(CLINIC_ID, []);
  });

  it("scopes boundary recompute to bounding box and currently assigned clinics", async () => {
    const assignedClinic: ClinicMembershipTarget = {
      id: 10,
      lat: 1,
      lng: 1,
      managerZoneId: LEAF_TERRITORY_ID,
    };
    const bboxClinic: ClinicMembershipTarget = {
      id: 11,
      lat: 2,
      lng: 2,
      managerZoneId: null,
    };

    const clinicWriter = createClinicWriter({
      findClinicsForMembership: mock(async (params?: { territoryIds?: number[]; boundingBox?: unknown }) => {
        if (params?.territoryIds) return [assignedClinic];
        if (params?.boundingBox) return [bboxClinic];
        return [];
      }),
    });

    const service = new TerritoryMembershipService({
      spatialRepository: {
        getBoundaryBoundingBox: mock(async () => ({
          minLng: 0,
          minLat: 0,
          maxLng: 3,
          maxLat: 3,
        })),
        findContainingClinicAssignmentTerritoryIds: mock(async () => []),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    const result = await service.recomputeForTerritoryBoundary(LEAF_TERRITORY_ID);

    expect(result.processed).toBe(2);
    expect(clinicWriter.findClinicsForMembership).toHaveBeenCalledTimes(2);
  });

  it("excludes the given territory when re-matching a clinic by geo", async () => {
    const clinicWriter = createClinicWriter();
    const findContainingClinicAssignmentTerritoryIds = mock(async () => [
      { id: 2, verticalId: 1 },
    ]);

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds,
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo(
      {
        id: CLINIC_ID,
        lat: -23.5,
        lng: -46.6,
        managerZoneId: REMOVED_TERRITORY_ID,
      },
      { excludeTerritoryId: REMOVED_TERRITORY_ID }
    );

    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledWith(-46.6, -23.5, {
      excludeTerritoryId: REMOVED_TERRITORY_ID,
    });
    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledWith(CLINIC_ID, [
      { verticalId: 1, managerZoneId: 2 },
    ]);
  });

  it("disassociateClinicsForTerritory re-matches every clinic currently on the territory", async () => {
    const clinics: ClinicMembershipTarget[] = [
      { id: 1, lat: 1, lng: 1, managerZoneId: ZONE_TERRITORY_ID },
      { id: 2, lat: 2, lng: 2, managerZoneId: ZONE_TERRITORY_ID },
    ];

    const clinicWriter = createClinicWriter({
      findClinicsForMembership: mock(async (params?: { territoryIds?: number[] }) =>
        params?.territoryIds?.includes(ZONE_TERRITORY_ID) ? clinics : []
      ),
    });
    const findContainingClinicAssignmentTerritoryIds = mock(async () => []);

    const service = new TerritoryMembershipService({
      spatialRepository: { findContainingClinicAssignmentTerritoryIds } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    const result = await service.disassociateClinicsForTerritory(ZONE_TERRITORY_ID);

    expect(result.processed).toBe(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledTimes(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledWith(1, 1, {
      excludeTerritoryId: ZONE_TERRITORY_ID,
    });
    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledTimes(2);
  });
});
