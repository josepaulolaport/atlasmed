import { describe, expect, it, mock } from "bun:test";
import {
  BoundaryImpactSetChangedError,
  OperationNotAllowedError,
} from "../../../../shared/errors";
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
    expect(() => assertAcceptedImpactFacilityIds([], [101])).toThrow(
      BoundaryImpactSetChangedError
    );
  });

  it("requires accepts when impact is non-empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([101], undefined)).toThrow(
      BoundaryImpactSetChangedError
    );
    expect(() => assertAcceptedImpactFacilityIds([101], [])).toThrow(
      BoundaryImpactSetChangedError
    );
  });

  it("requires exact set match", () => {
    expect(() => assertAcceptedImpactFacilityIds([101, 102], [101])).toThrow(
      BoundaryImpactSetChangedError
    );
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 102, 103])
    ).toThrow(BoundaryImpactSetChangedError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 103])
    ).toThrow(BoundaryImpactSetChangedError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [102, 101])
    ).not.toThrow();
  });

  /**
   * Spec 0009 R6: the point of the new error is that the caller can re-prompt on
   * what changed. A thrown 409 carrying no delta would be no better than the
   * `ValidationError` it replaced.
   */
  it("reports both directions of the delta", () => {
    // 102 appeared since the preview; 103 is no longer impacted.
    const error = (() => {
      try {
        assertAcceptedImpactFacilityIds([101, 102], [101, 103]);
      } catch (thrown) {
        return thrown as BoundaryImpactSetChangedError;
      }
      throw new Error("expected a mismatch to throw");
    })();

    expect(error).toBeInstanceOf(BoundaryImpactSetChangedError);
    expect(error.statusCode).toBe(409);
    // Not `context`: `AppError.toClientJSON` drops context for any code not on
    // its allowlist, so asserting the internal field would pass while the client
    // received nothing.
    expect(error.toClientJSON()).toEqual({
      code: "BOUNDARY_IMPACT_SET_CHANGED",
      message: expect.any(String),
      added: [102],
      removed: [103],
    });
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
   * when the write fails. That Postgres actually rolls back is proved separately
   * in `territory-boundary-atomicity.db.test.ts`.
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
    membershipChanged?: Array<{
      facilityVerticalProfileId: number;
      facilityId: number;
      managerZoneId: number | null;
    }>;
    ambiguous?: Array<{
      facilityVerticalProfileId: number;
      facilityId: number;
      verticalId: number;
      zoneIds: number[];
    }>;
  }) {
    const onBoundaryChanged = mock(async () => {});
    const onMembershipRecomputed = mock(async (_facilityIds: number[]) => {});
    const onAmbiguousManagerZones = mock((_matches: unknown[]) => {});
    const recomputeManagerZoneMembership = mock(async () => ({
      changed: options.membershipChanged ?? [],
      ambiguous: options.ambiguous ?? [],
    }));
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
      // Spec 0009 R1: the save path runs through the transaction port. The fake
      // hands back the same repositories, so the test still exercises the real
      // ordering — lock, validate, recompute, de-assign, write.
      transactionPort: {
        run: async (fn: (deps: never) => Promise<unknown>) =>
          fn({
            territoryRepository,
            territoryTypeRepository,
            spatialRepository,
            boundaryWriter: writer,
            // Spec 0009 R6: recomputed in-transaction. What it *computes* is
            // SQL and is proved in
            // `drizzle-facility-membership.recompute.db.test.ts`; here it only
            // has to exist so the ordering under test is the real one.
            membershipWriter: {
              recomputeManagerZoneMembership: recomputeManagerZoneMembership,
            },
            lockTerritory: async () => true,
          } as never),
      } as never,
      buildContainmentService: (repos) => new TerritoryContainmentService(repos),
      onBoundaryChanged,
      onMembershipRecomputed,
      onAmbiguousManagerZones,
    });

    return {
      useCases,
      writer,
      onBoundaryChanged,
      onMembershipRecomputed,
      onAmbiguousManagerZones,
      recomputeManagerZoneMembership,
    };
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
    ).rejects.toBeInstanceOf(BoundaryImpactSetChangedError);

    expect(writer.commitBoundaryChange).not.toHaveBeenCalled();
    expect(writer.activeProfileIds()).toEqual([
      impactedClinic.facilityVerticalProfileId,
    ]);
  });

  /**
   * What this proves: both writes are routed through a SINGLE port call, so no
   * code path can end assignments outside the transaction, and nothing is
   * published for a change that failed.
   *
   * What it does NOT prove: that Postgres rolls back. Asserting the fake's
   * post-failure state here would be circular — the fake's own `catch` performs
   * the restore. R1's integration test lives in
   * `territory-boundary-atomicity.db.test.ts`, against real rows.
   */
  it("routes both writes through one port call and publishes nothing on failure", async () => {
    const { useCases, writer, onBoundaryChanged, recomputeManagerZoneMembership } =
      buildUseCases({
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

    // One call carries the de-assignment and the geometry write together.
    expect(writer.commitBoundaryChange).toHaveBeenCalledTimes(1);
    expect(writer.boundaryWritten()).toBe(false);
    expect(onBoundaryChanged).not.toHaveBeenCalled();
    // Spec 0009 R6: membership follows the geometry. A boundary that was never
    // written must not have had its membership recomputed against it.
    expect(recomputeManagerZoneMembership).not.toHaveBeenCalled();
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
    const { useCases, writer, onBoundaryChanged, recomputeManagerZoneMembership } =
      buildUseCases({
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

    // Spec 0009 R6: the recompute is part of the save, not a job queued after
    // it. If this ever stops being called, HTTP 200 has gone back to meaning
    // "geometry written, ownership unknown".
    expect(recomputeManagerZoneMembership).toHaveBeenCalledWith(MANAGER_ZONE_ID);
  });

  /**
   * Meili's `territoryIds` is a projection of manager-zone membership, and
   * nothing else refreshes it after a boundary change — `fullSearchSyncWorkflow`
   * runs only when an operator posts to `/sync`, on no schedule. If the changed
   * set stops being published, search silently serves the old ownership until
   * someone triggers a full rebuild by hand.
   */
  it("publishes the clinics whose membership changed, de-duplicated, after commit", async () => {
    const { useCases, onMembershipRecomputed } = buildUseCases({
      orphanedPatches: [],
      membershipChanged: [
        // Two profiles on one clinic: the search document is per facility.
        { facilityVerticalProfileId: 501, facilityId: 101, managerZoneId: null },
        { facilityVerticalProfileId: 502, facilityId: 101, managerZoneId: null },
        { facilityVerticalProfileId: 503, facilityId: 102, managerZoneId: MANAGER_ZONE_ID },
      ],
    });

    await useCases.saveBoundary({
      territoryId: MANAGER_ZONE_ID,
      scope: globalScope as never,
      geoJson,
      acceptedFacilityIds: [impactedClinic.facilityId],
    });

    expect(onMembershipRecomputed).toHaveBeenCalledWith([101, 102]);
  });

  /**
   * Spec 0009 R4. `resolveVerticalMatches` computed ambiguity and nothing ever
   * read it, so a clinic covered by two same-vertical zones disappeared from
   * both managers' views leaving no trace — a data-integrity violation that hid
   * its own evidence.
   */
  it("reports clinics left covered by two zones", async () => {
    const ambiguous = [
      {
        facilityVerticalProfileId: 501,
        facilityId: 101,
        verticalId: 2,
        zoneIds: [MANAGER_ZONE_ID, 11],
      },
    ];
    const { useCases, onAmbiguousManagerZones } = buildUseCases({
      orphanedPatches: [],
      ambiguous,
    });

    await useCases.saveBoundary({
      territoryId: MANAGER_ZONE_ID,
      scope: globalScope as never,
      geoJson,
      acceptedFacilityIds: [impactedClinic.facilityId],
    });

    // Both competing zone ids travel with it: "which two" is the first question.
    expect(onAmbiguousManagerZones).toHaveBeenCalledWith(ambiguous);
  });

  it("reports no ambiguity when there is none", async () => {
    const { useCases, onAmbiguousManagerZones } = buildUseCases({ orphanedPatches: [] });

    await useCases.saveBoundary({
      territoryId: MANAGER_ZONE_ID,
      scope: globalScope as never,
      geoJson,
      acceptedFacilityIds: [impactedClinic.facilityId],
    });

    expect(onAmbiguousManagerZones).not.toHaveBeenCalled();
  });

  it("publishes nothing to search when the save fails", async () => {
    const { useCases, onMembershipRecomputed } = buildUseCases({
      orphanedPatches: [],
      failBoundaryWrite: true,
      membershipChanged: [
        { facilityVerticalProfileId: 501, facilityId: 101, managerZoneId: null },
      ],
    });

    await expect(
      useCases.saveBoundary({
        territoryId: MANAGER_ZONE_ID,
        scope: globalScope as never,
        geoJson,
        acceptedFacilityIds: [impactedClinic.facilityId],
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);

    expect(onMembershipRecomputed).not.toHaveBeenCalled();
  });
});
