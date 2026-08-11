import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type {
  GeoJsonGeometry,
  TerritorySpatialRepository,
} from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import { GEO_SIBLING_OVERLAP_EPSILON_SQ_M } from "../constants/territory-geo.constants";
import {
  isManagerZoneType,
  isRepPatchType,
} from "../constants/territory-roles.constants";
import { OperationNotAllowedError } from "../../../../shared/errors";

export interface ManagerZoneCandidate {
  id: number;
  /** Spec 0009 R9: `code` is gone; the slug is the readable identifier. */
  slug: string;
  name: string;
}

export interface RepPatchContainmentResolution {
  managerTerritoryId: number;
  candidates: ManagerZoneCandidate[];
}

/** Square metres are unreadable above a hectare; the operator drew in km. */
function formatOverlapArea(squareMeters: number): string {
  if (squareMeters >= 1_000_000) {
    return `${(squareMeters / 1_000_000).toFixed(2)} km²`;
  }
  return `${Math.round(squareMeters)} m²`;
}

export class TerritoryContainmentService {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      territoryTypeRepository: TerritoryTypeRepository;
      spatialRepository: TerritorySpatialRepository;
    }
  ) {}

  async assertSiblingOverlapAllowed(
    territory: TerritoryRecord,
    geoJson: GeoJsonGeometry
  ): Promise<void> {
    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type?.blockSiblingOverlap) {
      return;
    }

    const conflicts = await this.deps.spatialRepository.findOverlappingSiblingTerritories({
      territoryId: territory.id,
      territoryTypeId: territory.territoryTypeId,
      geoJson,
    });

    // Spec 0009 R3 / invariant I3: same-vertical zones must not overlap beyond
    // float noise. Anything the editor produces clips exactly (see the constant),
    // so a conflict reaching here is a real overlap, not a rounding artefact.
    const overlapping = conflicts.filter(
      (c) => c.overlapSquareMeters > GEO_SIBLING_OVERLAP_EPSILON_SQ_M
    );
    if (overlapping.length > 0) {
      throw new OperationNotAllowedError(
        "save_boundary",
        `Boundary overlaps sibling territories: ${overlapping
          .map((c) => `${c.slug} (${formatOverlapArea(c.overlapSquareMeters)})`)
          .join(", ")}`
      );
    }
  }

  async resolveRepPatchManagerZone(
    geoJson: GeoJsonGeometry,
    options?: { verticalId?: number }
  ): Promise<RepPatchContainmentResolution> {
    const candidates = await this.deps.spatialRepository.findContainingManagerZones({
      geoJson,
      verticalId: options?.verticalId,
    });

    if (candidates.length === 0) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "Rep patch must be fully contained inside exactly one active manager zone"
      );
    }

    if (candidates.length > 1) {
      throw new OperationNotAllowedError(
        "save_boundary",
        `Rep patch must be inside exactly one manager zone; found ${candidates.length}: ${candidates
          .map((c) => c.slug)
          .join(", ")}`
      );
    }

    return {
      managerTerritoryId: candidates[0]!.id,
      candidates,
    };
  }

  async assertManagerZoneContainsChildPatches(
    managerZoneId: number,
    geoJson: GeoJsonGeometry
  ): Promise<void> {
    const orphans = await this.deps.spatialRepository.findRepPatchesOutsideManagerZone({
      managerZoneId,
      managerZoneGeoJson: geoJson,
    });

    if (orphans.length > 0) {
      throw new OperationNotAllowedError(
        "save_boundary",
        `Manager zone boundary no longer contains rep patches: ${orphans
          .map((p) => p.slug)
          .join(", ")}`
      );
    }
  }

  async validateTerritoryRoleForBoundarySave(territory: TerritoryRecord): Promise<void> {
    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type) {
      throw new OperationNotAllowedError("save_boundary", "Territory type not found");
    }

    if (
      !isRepPatchType(type) &&
      !isManagerZoneType(type) &&
      !type.canHaveBoundary
    ) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "This territory type cannot have a boundary"
      );
    }
  }
}
