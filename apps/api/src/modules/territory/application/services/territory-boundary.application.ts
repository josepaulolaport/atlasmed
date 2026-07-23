import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "./territory-containment.service";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
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
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: string) => Promise<void>;
}

export type TerritoryBoundaryResolution =
  | {
      mode: "rep_patch";
      managerTerritoryId: string;
      managerZoneCandidates: Array<{ id: string; code: string; name: string }>;
      clinicRecomputeEnqueued: boolean;
    }
  | {
      mode: "manager_zone";
      repPatchCount: number;
    }
  | {
      mode: "other";
    };

export async function applyTerritoryBoundary(
  deps: ApplyTerritoryBoundaryDeps,
  territory: TerritoryRecord,
  geoJson: GeoJsonGeometry,
  options?: {
    /** When set (rep patch), prefer this manager zone if it fully contains the boundary. */
    preferredManagerTerritoryId?: string | null;
    /**
     * When false, skip clinic membership recompute (e.g. initial create).
     * Default true for boundary edits.
     */
    enqueueClinicRecompute?: boolean;
  }
): Promise<TerritoryBoundaryResolution> {
  const boundary = normalizeTerritoryBoundary(geoJson);
  const enqueueClinicRecompute = options?.enqueueClinicRecompute !== false;
  const type =
    territory.territoryType ??
    (await deps.territoryTypeRepository.findById(territory.territoryTypeId));

  if (!type) {
    throw new OperationNotAllowedError("save_boundary", "Territory type not found");
  }

  assertSinglePolygonForEditableTerritory(type, boundary, "save_boundary");

  await deps.containmentService.assertSiblingOverlapAllowed(territory, boundary);

  if (isRepPatchType(type)) {
    const resolution = await deps.containmentService.resolveRepPatchManagerZone(
      boundary,
      options?.preferredManagerTerritoryId
    );

    await deps.spatialRepository.saveBoundary(territory.id, boundary);
    await deps.spatialRepository.updateBoundaryMetadata(territory.id);

    await deps.territoryRepository.update(territory.id, {
      managerTerritoryId: resolution.managerTerritoryId,
    });

    if (enqueueClinicRecompute) {
      await deps.onBoundaryChanged?.(territory.id);
    }
    await deps.onManagerTerritoryChanged?.(resolution.managerTerritoryId);

    return {
      mode: "rep_patch",
      managerTerritoryId: resolution.managerTerritoryId,
      managerZoneCandidates: resolution.candidates,
      clinicRecomputeEnqueued: enqueueClinicRecompute,
    };
  }

  if (isManagerZoneType(type)) {
    await deps.containmentService.assertManagerZoneContainsChildPatches(
      territory.id,
      boundary
    );

    await deps.spatialRepository.saveBoundary(territory.id, boundary);
    await deps.spatialRepository.updateBoundaryMetadata(territory.id);

    const repPatchCount = await deps.territoryRepository.countRepPatchesByManagerZone(
      territory.id
    );

    if (enqueueClinicRecompute) {
      await deps.onBoundaryChanged?.(territory.id);
    }

    return {
      mode: "manager_zone",
      repPatchCount,
    };
  }

  if (!type.canHaveBoundary) {
    throw new OperationNotAllowedError(
      "save_boundary",
      "This territory type cannot have a boundary"
    );
  }

  await deps.spatialRepository.saveBoundary(territory.id, boundary, {
    repairInvalid: true,
  });
  await deps.spatialRepository.updateBoundaryMetadata(territory.id);

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
