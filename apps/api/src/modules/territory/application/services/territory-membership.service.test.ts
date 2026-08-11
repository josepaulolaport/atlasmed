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
    recomputeManagerZoneMembership: mock(async () => ({ changed: [], ambiguous: [] })),
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

  it("notifies search index after single membership write", async () => {
    const onClinicMembershipChanged = mock(async () => {});
    const clinicWriter = createClinicWriter();

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => [
          { id: LEAF_TERRITORY_ID, verticalId: 1 },
        ]),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
      onClinicMembershipChanged,
    });

    await service.assignClinicByGeo({
      id: CLINIC_ID,
      lat: -23.5,
      lng: -46.6,
      managerZoneId: null,
    });

    expect(onClinicMembershipChanged).toHaveBeenCalledWith(CLINIC_ID);
  });

  it("skips Meili notify on bulk recompute paths", async () => {
    const onClinicMembershipChanged = mock(async () => {});
    const clinicWriter = createClinicWriter({
      findClinicsForMembership: mock(async () => [
        {
          id: CLINIC_ID,
          lat: -23.5,
          lng: -46.6,
          managerZoneId: ZONE_TERRITORY_ID,
        },
      ]),
    });

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => [
          { id: LEAF_TERRITORY_ID, verticalId: 1 },
        ]),
        getBoundaryBoundingBox: mock(async () => null),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
      onClinicMembershipChanged,
    });

    await service.recomputeAll();
    await service.recomputeForTerritoryBoundary(ZONE_TERRITORY_ID);

    expect(onClinicMembershipChanged).not.toHaveBeenCalled();
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

  // The "scopes boundary recompute to bounding box and currently assigned
  // clinics" test was deleted with the per-clinic loop it described. Which
  // profiles a boundary change affects, and which zone wins, is now decided by
  // one SQL statement — a fake writer asserting it would only be re-stating the
  // fake. It is proved against a database in
  // `drizzle-facility-membership.recompute.db.test.ts`.

  /**
   * Spec 0009 R4, the half P5-5 could not reach: `assignClinicByGeo` computed
   * ambiguity into a boolean nobody read, so a clinic covered by two
   * same-vertical zones lost its membership silently.
   */
  it("reports a clinic covered by two same-vertical zones, and still clears it", async () => {
    const clinicWriter = createClinicWriter();
    const recordAmbiguousMatch = mock((_source: string, _count: number) => {});
    const logAmbiguousMatch = mock((_match: unknown) => {});

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => [
          { id: 7, verticalId: 1 },
          { id: 8, verticalId: 1 },
          // A second vertical matched cleanly and must be unaffected.
          { id: 9, verticalId: 2 },
        ]),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
      recordAmbiguousMatch,
      logAmbiguousMatch,
    });

    await service.assignClinicByGeo({
      id: CLINIC_ID,
      lat: -23.5,
      lng: -46.6,
      managerZoneId: null,
    });

    expect(recordAmbiguousMatch).toHaveBeenCalledWith("clinic_recompute", 1);
    expect(logAmbiguousMatch).toHaveBeenCalledWith({
      facilityId: CLINIC_ID,
      verticalId: 1,
      zoneIds: [7, 8],
    });
    // Membership still clears for the ambiguous vertical — no single owner can
    // be derived — while the unambiguous one is written as normal.
    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledWith(CLINIC_ID, [
      { verticalId: 2, managerZoneId: 9 },
    ]);
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
    const onClinicMembershipChanged = mock(async () => {});

    const service = new TerritoryMembershipService({
      spatialRepository: { findContainingClinicAssignmentTerritoryIds } as never,
      territoryRepository: {} as never,
      clinicWriter,
      onClinicMembershipChanged,
    });

    const result = await service.disassociateClinicsForTerritory(ZONE_TERRITORY_ID);

    expect(result.processed).toBe(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledTimes(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledWith(1, 1, {
      excludeTerritoryId: ZONE_TERRITORY_ID,
    });
    expect(clinicWriter.updateProfileTerritoryMemberships).toHaveBeenCalledTimes(2);
    // Bulk path: notifySearch:false — no per-clinic Meili upsert.
    expect(onClinicMembershipChanged).not.toHaveBeenCalled();
  });
});
