import { describe, expect, it, mock } from "bun:test";
import { OperationNotAllowedError, ValidationError } from "../../../../shared/errors";
import { TerritoryContainmentService } from "../services/territory-containment.service";
import type { BoundaryCommitCommand } from "../interfaces/territory-boundary.writer.interface";
import {
  assertAcceptedImpactFacilityIds,
  TerritoryBoundaryUseCases,
} from "./territory-boundary.use-cases";

describe("assertAcceptedImpactFacilityIds", () => {
  it("allows save when impact is empty and accepted omitted", () => {
    expect(() => assertAcceptedImpactFacilityIds([], undefined)).not.toThrow();
    expect(() => assertAcceptedImpactFacilityIds([], [])).not.toThrow();
  });

  it("rejects extra accepts when impact is empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([], [101])).toThrow(ValidationError);
  });

  it("requires accepts when impact is non-empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([101], undefined)).toThrow(
      ValidationError
    );
    expect(() => assertAcceptedImpactFacilityIds([101], [])).toThrow(ValidationError);
  });

  it("requires exact set match", () => {
    expect(() => assertAcceptedImpactFacilityIds([101, 102], [101])).toThrow(
      ValidationError
    );
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 102, 103])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 103])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [102, 101])
    ).not.toThrow();
  });
});

/**
 * Spec 0009 R1 — a boundary save that fails validation must not have ended any
 * rep assignment. Rep assignment rows are never deleted (I5), so an assignment
 * ended by a save that then failed cannot be restored.
 */
describe("TerritoryBoundaryUseCases.saveBoundary validate-before-mutate", () => {
  const MANAGER_ZONE_ID = 10;

  const geoJson = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  };

  const managerZoneType = {
    id: 1,
    slug: "manager_zone",
    name: "Zona",
    canHaveBoundary: true,
    blockSiblingOverlap: true,
  };

  const impactedClinic = {
    facilityId: 101,
    facilityName: "Clínica A",
    facilityVerticalProfileId: 501,
    consultantUserId: 77,
    consultantName: "Rep A",
  };

  const globalScope = { isGlobal: true, effectiveTerritoryIds: [] };

  /**
   * Stands in for `DrizzleTerritoryBoundaryWriter`, modelling the contract the
   * real adapter gets from `db.transaction`: the de-assignments and the geometry
   * write either both land or neither does.
   *
   * This proves the *use-case* side — that there is no longer any path which
   * ends assignments outside the boundary write, and that nothing is published
   * when the write fails. It does not prove Postgres rolls back; `apps/api` has
   * no real-database test harness (see report).
   */
  function createFakeBoundaryWriter(options: { failBoundaryWrite?: boolean }) {
    let activeProfileIds = new Set<number>([impactedClinic.facilityVerticalProfileId]);
    let boundaryWritten = false;

    const commitBoundaryChange = mock(async (command: BoundaryCommitCommand) => {
      const rollbackProfileIds = new Set(activeProfileIds);
      const rollbackBoundaryWritten = boundaryWritten;

      try {
        for (const profileId of command.endAssignmentsForProfileIds) {
          activeProfileIds.delete(profileId);
        }

        if (options.failBoundaryWrite) {
          throw new OperationNotAllowedError("save_boundary", "Invalid geometry");
        }

        boundaryWritten = true;
        return { endedAssignmentCount: command.endAssignmentsForProfileIds.length, repPatchCount: 3 };
      } catch (error) {
        activeProfileIds = rollbackProfileIds;
        boundaryWritten = rollbackBoundaryWritten;
        throw error;
      }
    });

    return {
      commitBoundaryChange,
      activeProfileIds: () => [...activeProfileIds],
      boundaryWritten: () => boundaryWritten,
    };
  }

  function buildUseCases(options: {
    orphanedPatches: Array<{ id: number; code: string }>;
    failBoundaryWrite?: boolean;
  }) {
    const onBoundaryChanged = mock(async () => {});
    const writer = createFakeBoundaryWriter({
      failBoundaryWrite: options.failBoundaryWrite,
    });

    const spatialRepository = {
      findAssignedClinicsImpactedByBoundary: async () => [impactedClinic],
      findRepPatchesOutsideManagerZone: async () => options.orphanedPatches,
      findOverlappingSiblingTerritories: async () => [],
    };

    const territoryRepository = {
      findById: async () => ({
        id: MANAGER_ZONE_ID,
        isActive: true,
        verticalId: 2,
        territoryTypeId: managerZoneType.id,
        territoryType: managerZoneType,
      }),
    };

    const territoryTypeRepository = {
      findById: async () => managerZoneType,
    };

    const useCases = new TerritoryBoundaryUseCases({
      territoryRepository: territoryRepository as never,
      territoryTypeRepository: territoryTypeRepository as never,
      spatialRepository: spatialRepository as never,
      containmentService: new TerritoryContainmentService({
        territoryRepository: territoryRepository as never,
        territoryTypeRepository: territoryTypeRepository as never,
        spatialRepository: spatialRepository as never,
      }),
      boundaryWriter: writer as never,
      onBoundaryChanged,
    });

    return { useCases, writer, onBoundaryChanged };
  }

  it("leaves rep assignments intact when child-patch containment fails", async () => {
    const { useCases, writer, onBoundaryChanged } = buildUseCases({
      orphanedPatches: [{ id: 20, code: "P-1" }],
    });

    await expect(
      useCases.saveBoundary({
        territoryId: MANAGER_ZONE_ID,
        scope: globalScope as never,
        geoJson,
        acceptedFacilityIds: [impactedClinic.facilityId],
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);

    expect(writer.commitBoundaryChange).not.toHaveBeenCalled();
    expect(writer.activeProfileIds()).toEqual([
      impactedClinic.facilityVerticalProfileId,
    ]);
    expect(writer.boundaryWritten()).toBe(false);
    expect(onBoundaryChanged).not.toHaveBeenCalled();
  });

  it("still rejects an unaccepted impact set without ending assignments", async () => {
    const { useCases, writer } = buildUseCases({ orphanedPatches: [] });

    await expect(
      useCases.saveBoundary({
        territoryId: MANAGER_ZONE_ID,
        scope: globalScope as never,
        geoJson,
        acceptedFacilityIds: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(writer.commitBoundaryChange).not.toHaveBeenCalled();
    expect(writer.activeProfileIds()).toEqual([
      impactedClinic.facilityVerticalProfileId,
    ]);
  });

  it("rolls the de-assignments back when the boundary write fails", async () => {
    const { useCases, writer, onBoundaryChanged } = buildUseCases({
      orphanedPatches: [],
      failBoundaryWrite: true,
    });

    await expect(
      useCases.saveBoundary({
        territoryId: MANAGER_ZONE_ID,
        scope: globalScope as never,
        geoJson,
        acceptedFacilityIds: [impactedClinic.facilityId],
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);

    // The de-assignment was attempted, but inside the same transaction as the
    // failed geometry write — so the assignment is still active afterwards.
    expect(writer.commitBoundaryChange).toHaveBeenCalledTimes(1);
    expect(writer.activeProfileIds()).toEqual([
      impactedClinic.facilityVerticalProfileId,
    ]);
    expect(writer.boundaryWritten()).toBe(false);
    // Nothing may be published for a change that rolled back.
    expect(onBoundaryChanged).not.toHaveBeenCalled();
  });

  it("ends assignments and writes the boundary in a single writer call", async () => {
    const { useCases, writer } = buildUseCases({ orphanedPatches: [] });

    await useCases.saveBoundary({
      territoryId: MANAGER_ZONE_ID,
      scope: globalScope as never,
      geoJson,
      acceptedFacilityIds: [impactedClinic.facilityId],
    });

    // Structural guarantee: one port call carries both writes, so no code path
    // can end assignments outside the boundary transaction.
    expect(writer.commitBoundaryChange).toHaveBeenCalledTimes(1);
    expect(writer.commitBoundaryChange.mock.calls[0]![0]).toMatchObject({
      territoryId: MANAGER_ZONE_ID,
      endAssignmentsForProfileIds: [impactedClinic.facilityVerticalProfileId],
      endReason: "boundary_impact",
      countRepPatches: true,
      repairInvalid: false,
    });
  });

  it("ends assignments and writes the boundary when everything validates", async () => {
    const { useCases, writer, onBoundaryChanged } = buildUseCases({
      orphanedPatches: [],
    });

    const result = await useCases.saveBoundary({
      territoryId: MANAGER_ZONE_ID,
      scope: globalScope as never,
      geoJson,
      acceptedFacilityIds: [impactedClinic.facilityId],
    });

    expect(writer.activeProfileIds()).toEqual([]);
    expect(writer.boundaryWritten()).toBe(true);
    expect(onBoundaryChanged).toHaveBeenCalledWith(MANAGER_ZONE_ID);
    expect(result).toMatchObject({ mode: "manager_zone", repPatchCount: 3 });
  });
});
