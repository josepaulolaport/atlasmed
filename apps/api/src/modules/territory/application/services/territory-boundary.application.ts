import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "./territory-containment.service";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import type {
  BoundaryCommitCommand,
  TerritoryBoundaryWriter,
} from "../interfaces/territory-boundary.writer.interface";
import {
  isManagerZoneType,
  isRepPatchType,
} from "../constants/territory-roles.constants";
import {
  assertSinglePolygonForEditableTerritory,
  normalizeTerritoryBoundary,
} from "../utils/territory-boundary.utils";
import { OperationNotAllowedError } from "../../../../shared/errors";

export type { GeoJsonGeometry };

export interface ApplyTerritoryBoundaryDeps {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  onBoundaryChanged?: (territoryId: number) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: number) => Promise<void>;
}

export type TerritoryBoundaryResolution =
  | {
      mode: "rep_patch";
      managerTerritoryId: number;
      managerZoneCandidates: Array<{ id: number; slug: string; name: string }>;
      clinicRecomputeEnqueued: boolean;
    }
  | {
      mode: "manager_zone";
      repPatchCount: number;
    }
  | {
      mode: "other";
    };

/**
 * A validated, not-yet-written boundary change.
 *
 * Spec 0009 R1: every check that can reject a boundary save runs while building
 * the plan, so a caller can validate the whole change *before* it mutates
 * anything (notably before it ends rep assignments).
 */
export type TerritoryBoundaryPlan =
  | {
      mode: "rep_patch";
      boundary: GeoJsonGeometry;
      managerTerritoryId: number;
      managerZoneCandidates: Array<{ id: number; slug: string; name: string }>;
    }
  | { mode: "manager_zone"; boundary: GeoJsonGeometry }
  | { mode: "other"; boundary: GeoJsonGeometry };

/**
 * Read-only phase: normalize + validate the proposed geometry.
 *
 * Spec 0009 R1 order: geometry → containment → sibling overlap.
 * Performs no writes and fires no side effects; every rejection throws here.
 */
export async function planTerritoryBoundary(
  deps: ApplyTerritoryBoundaryDeps,
  territory: TerritoryRecord,
  geoJson: GeoJsonGeometry
): Promise<TerritoryBoundaryPlan> {
  const boundary = normalizeTerritoryBoundary(geoJson);
  const type =
    territory.territoryType ??
    (await deps.territoryTypeRepository.findById(territory.territoryTypeId));

  if (!type) {
    throw new OperationNotAllowedError("save_boundary", "Territory type not found");
  }

  assertSinglePolygonForEditableTerritory(type, boundary, "save_boundary");

  if (isRepPatchType(type)) {
    const resolution = await deps.containmentService.resolveRepPatchManagerZone(boundary, {
      verticalId: territory.verticalId,
    });

    await deps.containmentService.assertSiblingOverlapAllowed(territory, boundary);

    return {
      mode: "rep_patch",
      boundary,
      managerTerritoryId: resolution.managerTerritoryId,
      managerZoneCandidates: resolution.candidates,
    };
  }

  if (isManagerZoneType(type)) {
    await deps.containmentService.assertManagerZoneContainsChildPatches(
      territory.id,
      boundary
    );

    await deps.containmentService.assertSiblingOverlapAllowed(territory, boundary);

    return { mode: "manager_zone", boundary };
  }

  if (!type.canHaveBoundary) {
    throw new OperationNotAllowedError(
      "save_boundary",
      "This territory type cannot have a boundary"
    );
  }

  await deps.containmentService.assertSiblingOverlapAllowed(territory, boundary);

  return { mode: "other", boundary };
}

/**
 * `applyTerritoryBoundary` and `commitTerritoryBoundary` are gone (spec 0009 R1).
 *
 * Between them they were a second, un-transactional way to write a boundary:
 * validate, then save the geometry, then fire side effects — each step its own
 * commit. `saveBoundary` stopped using them when R1 landed, leaving
 * `createTerritory` as the only caller and the only place a rejected geometry
 * could still leave a half-made territory behind.
 *
 * Both write paths now go through `planTerritoryBoundary` +
 * `TerritoryBoundaryWriter.commitBoundaryChange` inside one transaction. Leaving
 * the old pair exported was the standing invitation for a third caller to
 * reintroduce D-01, which the R1 diagnosis called out and which creation had in
 * fact never stopped doing.
 */

export interface AtomicBoundaryCommitDeps {
  boundaryWriter: TerritoryBoundaryWriter;
  onBoundaryChanged?: (territoryId: number) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: number) => Promise<void>;
}

export function toBoundaryCommitCommand(
  territoryId: number,
  plan: TerritoryBoundaryPlan,
  assignments: {
    endForProfileIds: number[];
    endReason: string;
    /**
     * Spec 0009 R2/R5: who ended these assignments. Manager-zone edits are
     * ADMIN-only, so without this an admin's redraw ends rep assignments a
     * manager made and leaves only `end_reason` behind — why, never who.
     */
    endedByUserId?: number | null;
  }
): BoundaryCommitCommand {
  const base = {
    territoryId,
    boundary: plan.boundary,
    endAssignmentsForProfileIds: assignments.endForProfileIds,
    endReason: assignments.endReason,
    endedByUserId: assignments.endedByUserId ?? null,
  };

  if (plan.mode === "rep_patch") {
    return {
      ...base,
      repairInvalid: false,
      managerTerritoryId: plan.managerTerritoryId,
      countRepPatches: false,
    };
  }

  if (plan.mode === "manager_zone") {
    return { ...base, repairInvalid: false, countRepPatches: true };
  }

  return { ...base, repairInvalid: true, countRepPatches: false };
}

/**
 * Describe what a committed plan produced. Pure: the caller publishes side
 * effects itself, after the transaction commits.
 */
export function resolveBoundaryOutcome(
  plan: TerritoryBoundaryPlan,
  result: { repPatchCount?: number | null }
): TerritoryBoundaryResolution {
  if (plan.mode === "rep_patch") {
    // Spec 0006: patch edits do not recompute clinic→zone membership.
    return {
      mode: "rep_patch",
      managerTerritoryId: plan.managerTerritoryId,
      managerZoneCandidates: plan.managerZoneCandidates,
      clinicRecomputeEnqueued: false,
    };
  }

  if (plan.mode === "manager_zone") {
    return { mode: "manager_zone", repPatchCount: result.repPatchCount ?? 0 };
  }

  return { mode: "other" };
}

export function assertBoundaryProvidedForType(
  canHaveBoundary: boolean,
  boundary: GeoJsonGeometry | undefined | null
): GeoJsonGeometry {
  if (!canHaveBoundary) {
    if (boundary) {
      throw new OperationNotAllowedError(
        "create_territory",
        "This territory type cannot have a boundary"
      );
    }
    return undefined as never;
  }

  if (!boundary) {
    throw new OperationNotAllowedError(
      "create_territory",
      "A geographic boundary is required when creating this territory type"
    );
  }

  return normalizeTerritoryBoundary(boundary);
}
