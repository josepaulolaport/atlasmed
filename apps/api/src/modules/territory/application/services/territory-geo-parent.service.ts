import type { TerritoryRepository, TerritoryRecord } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRollupRepository } from "../interfaces/territory-rollup.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type {
  GeoJsonGeometry,
  TerritorySpatialRepository,
} from "../interfaces/territory-spatial.repository.interface";
import { TerritoryClosureService } from "./territory-closure.service";
import { TerritoryHierarchyValidator } from "./territory-hierarchy-validator.service";
import {
  GEO_AMBIGUOUS_MARGIN,
  GEO_PARENT_AUTO_THRESHOLD,
  GEO_ROLLUP_THRESHOLD,
  GEO_SIBLING_OVERLAP_BLOCK_RATIO,
} from "../constants/territory-geo.constants";
import { OperationNotAllowedError } from "../../../../shared/errors";

export interface GeoParentResolution {
  primaryParentId: string | null;
  rollupAncestorIds: string[];
  parentAssignmentStatus: "resolved" | "ambiguous" | "manual";
  parentAssignmentSource: "geo";
  candidates: Array<{ id: string; code: string; overlapRatio: number }>;
}

export class TerritoryGeoParentService {
  private readonly closureService: TerritoryClosureService;
  private readonly hierarchyValidator: TerritoryHierarchyValidator;

  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      territoryTypeRepository: TerritoryTypeRepository;
      closureRepository: TerritoryClosureRepository;
      spatialRepository: TerritorySpatialRepository;
      rollupRepository: TerritoryRollupRepository;
      closureService?: TerritoryClosureService;
      hierarchyValidator?: TerritoryHierarchyValidator;
      onScopeInvalidated?: (territoryIds: string[]) => Promise<void>;
    }
  ) {
    this.closureService =
      deps.closureService ??
      new TerritoryClosureService({
        territoryRepository: deps.territoryRepository,
        closureRepository: deps.closureRepository,
      });
    this.hierarchyValidator =
      deps.hierarchyValidator ?? new TerritoryHierarchyValidator();
  }

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
      countryCode: territory.countryCode ?? "BR",
      geoJson,
    });

    const substantial = conflicts.filter(
      (c) => c.overlapRatio > GEO_SIBLING_OVERLAP_BLOCK_RATIO
    );
    if (substantial.length > 0) {
      throw new OperationNotAllowedError(
        "save_boundary",
        `Boundary substantially overlaps sibling territories: ${substantial
          .map((c) => `${c.code} (${Math.round(c.overlapRatio * 100)}%)`)
          .join(", ")}`
      );
    }
  }

  async resolveParentFromBoundary(
    territory: TerritoryRecord,
    geoJson: GeoJsonGeometry
  ): Promise<GeoParentResolution> {
    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));

    if (type?.isCountryLevel) {
      return {
        primaryParentId: null,
        rollupAncestorIds: [],
        parentAssignmentStatus: "resolved",
        parentAssignmentSource: "geo",
        candidates: [],
      };
    }

    const descendantIds = await this.deps.closureRepository.findDescendantIds(
      [territory.id],
      false
    );

    const candidates = await this.deps.spatialRepository.scoreParentCandidates({
      territoryId: territory.id,
      geoJson,
      countryCode: territory.countryCode ?? "BR",
      excludeTerritoryIds: [territory.id, ...descendantIds],
    });

    const ranked = candidates
      .filter((c) => c.overlapRatio >= GEO_ROLLUP_THRESHOLD)
      .sort((a, b) => b.overlapRatio - a.overlapRatio);

    if (ranked.length === 0) {
      return {
        primaryParentId: territory.parentId,
        rollupAncestorIds: [],
        parentAssignmentStatus: "ambiguous",
        parentAssignmentSource: "geo",
        candidates: [],
      };
    }

    const top = ranked[0]!;
    const second = ranked[1];
    const clearWinner =
      top.overlapRatio >= GEO_PARENT_AUTO_THRESHOLD &&
      (!second || top.overlapRatio - second.overlapRatio >= GEO_AMBIGUOUS_MARGIN);

    const primaryParentId = clearWinner ? top.id : territory.parentId;
    const rollupAncestorIds = ranked
      .filter((c) => c.id !== primaryParentId)
      .map((c) => c.id);

    return {
      primaryParentId,
      rollupAncestorIds,
      parentAssignmentStatus: clearWinner ? "resolved" : "ambiguous",
      parentAssignmentSource: "geo",
      candidates: ranked.map((c) => ({
        id: c.id,
        code: c.code,
        overlapRatio: c.overlapRatio,
      })),
    };
  }

  async applyGeoParentResolution(
    territory: TerritoryRecord,
    resolution: GeoParentResolution
  ): Promise<TerritoryRecord> {
    let updated = territory;

    if (
      resolution.primaryParentId &&
      resolution.primaryParentId !== territory.parentId &&
      resolution.parentAssignmentStatus === "resolved"
    ) {
      const newParent = await this.deps.territoryRepository.findById(
        resolution.primaryParentId
      );
      if (!newParent) {
        throw new OperationNotAllowedError(
          "save_boundary",
          "Resolved geo parent no longer exists"
        );
      }

      const parentType =
        newParent.territoryType ??
        (await this.deps.territoryTypeRepository.findById(newParent.territoryTypeId));
      const territoryType =
        territory.territoryType ??
        (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
      if (!parentType || !territoryType) {
        throw new OperationNotAllowedError("save_boundary", "Territory type not found");
      }

      const descendantIds = await this.deps.closureRepository.findDescendantIds(
        [territory.id],
        false
      );
      this.hierarchyValidator.validateReparent({
        territory,
        territoryType,
        newParent,
        descendantIds,
      });

      updated = await this.deps.territoryRepository.update(territory.id, {
        parentId: resolution.primaryParentId,
        parentAssignmentStatus: resolution.parentAssignmentStatus,
        parentAssignmentSource: resolution.parentAssignmentSource,
      });
      await this.closureService.rebuildSubtree(territory.id);
      await this.deps.onScopeInvalidated?.([territory.id, resolution.primaryParentId]);
    } else {
      updated = await this.deps.territoryRepository.update(territory.id, {
        parentAssignmentStatus: resolution.parentAssignmentStatus,
        parentAssignmentSource: resolution.parentAssignmentSource,
      });
    }

    await this.deps.rollupRepository.replaceGeoRollupLinks(
      territory.id,
      resolution.rollupAncestorIds
    );

    return updated;
  }
}
