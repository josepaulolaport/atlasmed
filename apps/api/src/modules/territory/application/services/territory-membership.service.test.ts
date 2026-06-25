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
});
