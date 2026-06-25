import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryGeoParentService } from "./territory-geo-parent.service";
import type { TerritoryGeoMembershipService } from "./territory-geo-membership.service";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import {
  isOperationalTerritoryType,
  isReferenceGeographyType,
} from "../constants/territory-geo-membership.constants";
import {
  normalizeTerritoryBoundary,
} from "../utils/territory-boundary.utils";
import { OperationNotAllowedError } from "../../../../shared/errors";

export type { GeoJsonGeometry };

export interface ApplyTerritoryBoundaryDeps {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  geoParentService: TerritoryGeoParentService;
  geoMembershipService: TerritoryGeoMembershipService;
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
}

export type TerritoryBoundaryResolution =
  | {
      mode: "operational";
      geoMembershipStatus: "ready";
      membershipCount: number;
      referenceTerritoryIds: string[];
    }
  | {
      mode: "reference";
      parentAssignmentStatus: "resolved" | "ambiguous" | "manual";
      parentAssignmentSource: "geo";
      primaryParentId: string | null;
      rollupAncestorIds: string[];
      candidates: Array<{ id: string; code: string; overlapRatio: number }>;
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

  await deps.geoParentService.assertSiblingOverlapAllowed(territory, boundary);
  await deps.spatialRepository.saveBoundary(territory.id, boundary, {
    repairInvalid: isReferenceGeographyType(type),
  });
  await deps.spatialRepository.updateBoundaryMetadata(territory.id);

  if (isOperationalTerritoryType(type)) {
    const membership = await deps.geoMembershipService.rebuildForOperationalTerritory(
      territory.id
    );
    await deps.onBoundaryChanged?.(territory.id);

    return {
      mode: "operational",
      geoMembershipStatus: "ready",
      membershipCount: membership.membershipCount,
      referenceTerritoryIds: membership.referenceTerritoryIds,
    };
  }

  if (isReferenceGeographyType(type)) {
    return {
      mode: "reference",
      parentAssignmentStatus: territory.parentId ? "resolved" : territory.parentAssignmentStatus,
      parentAssignmentSource: "geo",
      primaryParentId: territory.parentId,
      rollupAncestorIds: [],
      candidates: [],
    };
  }

  const resolution = await deps.geoParentService.resolveParentFromBoundary(territory, boundary);
  await deps.geoParentService.applyGeoParentResolution(territory, resolution);

  return {
    mode: "reference",
    parentAssignmentStatus: resolution.parentAssignmentStatus,
    parentAssignmentSource: resolution.parentAssignmentSource,
    primaryParentId: resolution.primaryParentId,
    rollupAncestorIds: resolution.rollupAncestorIds,
    candidates: resolution.candidates,
  };
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
