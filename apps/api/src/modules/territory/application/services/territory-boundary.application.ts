import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "./territory-containment.service";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import {
  isGroupingHierarchyType,
  isManagerZoneType,
  isRepPatchType,
} from "../constants/territory-roles.constants";
import { normalizeTerritoryBoundary } from "../utils/territory-boundary.utils";
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
      mode: "grouping";
    };

export async function applyTerritoryBoundary(
  deps: ApplyTerritoryBoundaryDeps,
  territory: TerritoryRecord,
  geoJson: GeoJsonGeometry
): Promise<TerritoryBoundaryResolution> {
  const boundary = normalizeTerritoryBoundary(geoJson);
  const type =
    territory.territoryType ??
    (await deps.territoryTypeRepository.findById(territory.territoryTypeId));

  if (!type) {
    throw new OperationNotAllowedError("save_boundary", "Territory type not found");
  }

  await deps.containmentService.assertSiblingOverlapAllowed(territory, boundary);

  if (isRepPatchType(type)) {
    const resolution = await deps.containmentService.resolveRepPatchManagerZone(
      boundary,
      territory.countryCode ?? "BR"
    );

    await deps.spatialRepository.saveBoundary(territory.id, boundary);
    await deps.spatialRepository.updateBoundaryMetadata(territory.id);

    await deps.territoryRepository.update(territory.id, {
      managerTerritoryId: resolution.managerTerritoryId,
    });

    await deps.onBoundaryChanged?.(territory.id);
    await deps.onManagerTerritoryChanged?.(resolution.managerTerritoryId);

    return {
      mode: "rep_patch",
      managerTerritoryId: resolution.managerTerritoryId,
      managerZoneCandidates: resolution.candidates,
      clinicRecomputeEnqueued: true,
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

    await deps.onBoundaryChanged?.(territory.id);

    return {
      mode: "manager_zone",
      repPatchCount,
    };
  }

  if (isGroupingHierarchyType(type)) {
    await deps.spatialRepository.saveBoundary(territory.id, boundary, {
      repairInvalid: true,
    });
    await deps.spatialRepository.updateBoundaryMetadata(territory.id);

    return { mode: "grouping" };
  }

  if (!type.canHaveBoundary) {
    throw new OperationNotAllowedError(
      "save_boundary",
      "This territory type cannot have a boundary"
    );
  }

  await deps.spatialRepository.saveBoundary(territory.id, boundary);
  await deps.spatialRepository.updateBoundaryMetadata(territory.id);

  return { mode: "grouping" };
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
