import type { GeoJsonGeometry } from "./territory-spatial.repository.interface";

/**
 * Spec 0009 R1 — a boundary save ends rep assignments *and* rewrites the
 * territory geometry. Those writes must land together or not at all: rep
 * assignment rows are never deleted (I5), so an assignment ended by a save that
 * then failed cannot be restored.
 *
 * The transaction boundary therefore lives in infrastructure, in a single
 * adapter method that owns every statement — not in the use-case, which holds
 * repositories bound to the module-level `db` singleton and could only open a
 * transaction those repositories would not join.
 */
export interface BoundaryCommitCommand {
  territoryId: number;
  /** Already normalized and validated by `planTerritoryBoundary`. */
  boundary: GeoJsonGeometry;
  /** `ST_MakeValid` instead of rejecting — types that are not hand-drawn. */
  repairInvalid: boolean;
  /** Rep assignments to end in the same transaction. Empty means none. */
  endAssignmentsForProfileIds: number[];
  endReason: string;
  /** rep_patch: resolved owning manager zone, written to the territory row. */
  managerTerritoryId?: number;
  /** manager_zone: read the child patch count inside the transaction. */
  countRepPatches: boolean;
}

export interface BoundaryCommitResult {
  endedAssignmentCount: number;
  repPatchCount: number | null;
}

export interface TerritoryBoundaryWriter {
  /**
   * Applies the whole boundary change atomically. Throws without having
   * written anything if the geometry is rejected by PostGIS.
   *
   * Fires no notifications — callers publish only after this resolves, so no
   * downstream job ever observes uncommitted rows.
   */
  commitBoundaryChange(command: BoundaryCommitCommand): Promise<BoundaryCommitResult>;
}
