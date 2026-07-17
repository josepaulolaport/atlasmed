import { describe, expect, it, mock } from "bun:test";
import { TerritoryMembershipService } from "./territory-membership.service";
import type { ClinicMembershipTarget } from "./territory-membership.service";

describe("TerritoryMembershipService", () => {
  it("assigns clinic to a single matching leaf territory", async () => {
    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async () => []),
    };

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => ["leaf-1"]),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo({
      id: "clinic-1",
      lat: -23.5,
      lng: -46.6,
      territoryId: null,
      territoryAssignmentSource: "geo",
    });

    expect(clinicWriter.updateTerritoryMembership).toHaveBeenCalledWith("clinic-1", {
      territoryId: "leaf-1",
      territoryAssignmentStatus: "assigned",
      territoryAssignmentSource: "geo",
    });
  });

  it("scopes boundary recompute to bounding box and currently assigned clinics", async () => {
    const assignedClinic: ClinicMembershipTarget = {
      id: "assigned",
      lat: 1,
      lng: 1,
      territoryId: "leaf-1",
      territoryAssignmentSource: "geo",
    };
    const bboxClinic: ClinicMembershipTarget = {
      id: "in-bbox",
      lat: 2,
      lng: 2,
      territoryId: null,
      territoryAssignmentSource: "geo",
    };

    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async (params?: { territoryIds?: string[]; boundingBox?: unknown }) => {
        if (params?.territoryIds) return [assignedClinic];
        if (params?.boundingBox) return [bboxClinic];
        return [];
      }),
    };

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

    const result = await service.recomputeForTerritoryBoundary("leaf-1");

    expect(result.processed).toBe(2);
    expect(clinicWriter.findClinicsForMembership).toHaveBeenCalledTimes(2);
  });

  it("excludes the given territory when re-matching a clinic by geo", async () => {
    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async () => []),
    };
    const findContainingClinicAssignmentTerritoryIds = mock(async () => ["other-leaf"]);

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds,
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo(
      {
        id: "clinic-1",
        lat: -23.5,
        lng: -46.6,
        territoryId: "removed-territory",
        territoryAssignmentSource: "geo",
      },
      { excludeTerritoryId: "removed-territory" }
    );

    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledWith(-46.6, -23.5, {
      excludeTerritoryId: "removed-territory",
    });
    expect(clinicWriter.updateTerritoryMembership).toHaveBeenCalledWith("clinic-1", {
      territoryId: "other-leaf",
      territoryAssignmentStatus: "assigned",
      territoryAssignmentSource: "geo",
    });
  });

  it("forces re-match of manually-pinned clinics when force is set", async () => {
    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async () => []),
    };

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => []),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo(
      {
        id: "manual-clinic",
        lat: -23.5,
        lng: -46.6,
        territoryId: "removed-territory",
        territoryAssignmentSource: "manual",
      },
      { excludeTerritoryId: "removed-territory", force: true }
    );

    expect(clinicWriter.updateTerritoryMembership).toHaveBeenCalledWith("manual-clinic", {
      territoryId: null,
      territoryAssignmentStatus: "unassigned",
      territoryAssignmentSource: "geo",
    });
  });

  it("does not touch manually-pinned clinics without force", async () => {
    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async () => []),
    };

    const service = new TerritoryMembershipService({
      spatialRepository: {
        findContainingClinicAssignmentTerritoryIds: mock(async () => []),
      } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    await service.assignClinicByGeo({
      id: "manual-clinic",
      lat: -23.5,
      lng: -46.6,
      territoryId: "some-territory",
      territoryAssignmentSource: "manual",
    });

    expect(clinicWriter.updateTerritoryMembership).not.toHaveBeenCalled();
  });

  it("disassociateClinicsForTerritory re-matches every clinic currently on the territory", async () => {
    const clinics: ClinicMembershipTarget[] = [
      { id: "c1", lat: 1, lng: 1, territoryId: "zone-1", territoryAssignmentSource: "geo" },
      { id: "c2", lat: 2, lng: 2, territoryId: "zone-1", territoryAssignmentSource: "manual" },
    ];

    const clinicWriter = {
      updateTerritoryMembership: mock(async () => {}),
      findClinicsForMembership: mock(async (params?: { territoryIds?: string[] }) =>
        params?.territoryIds?.includes("zone-1") ? clinics : []
      ),
    };
    const findContainingClinicAssignmentTerritoryIds = mock(async () => []);

    const service = new TerritoryMembershipService({
      spatialRepository: { findContainingClinicAssignmentTerritoryIds } as never,
      territoryRepository: {} as never,
      clinicWriter,
    });

    const result = await service.disassociateClinicsForTerritory("zone-1");

    expect(result.processed).toBe(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledTimes(2);
    expect(findContainingClinicAssignmentTerritoryIds).toHaveBeenCalledWith(1, 1, {
      excludeTerritoryId: "zone-1",
    });
    expect(clinicWriter.updateTerritoryMembership).toHaveBeenCalledWith("c1", {
      territoryId: null,
      territoryAssignmentStatus: "unassigned",
      territoryAssignmentSource: "geo",
    });
    expect(clinicWriter.updateTerritoryMembership).toHaveBeenCalledWith("c2", {
      territoryId: null,
      territoryAssignmentStatus: "unassigned",
      territoryAssignmentSource: "geo",
    });
  });
});
