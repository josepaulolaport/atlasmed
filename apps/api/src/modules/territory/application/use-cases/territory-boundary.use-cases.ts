import type { ScopeContext } from "@atlasmed/access";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryGeoParentService } from "../services/territory-geo-parent.service";
import type { TerritoryGeoMembershipService } from "../services/territory-geo-membership.service";
import { TerritoryHierarchyValidator } from "../services/territory-hierarchy-validator.service";
import { applyTerritoryBoundary } from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";
import { assertLeafTerritoryInJurisdiction } from "../services/territory-scope-policy.service";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  closureRepository: TerritoryClosureRepository;
  geoParentService: TerritoryGeoParentService;
  geoMembershipService: TerritoryGeoMembershipService;
  hierarchyValidator?: TerritoryHierarchyValidator;
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
}

export class TerritoryBoundaryUseCases {
  private readonly hierarchyValidator: TerritoryHierarchyValidator;

  constructor(private readonly deps: Dependencies) {
    this.hierarchyValidator =
      deps.hierarchyValidator ?? new TerritoryHierarchyValidator();
  }

  async getBoundary(input: { territoryId: string; scope: ScopeContext }) {
    await this.assertReadable(input.territoryId, input.scope);

    const boundary = await this.deps.spatialRepository.getBoundaryAsGeoJson(
      input.territoryId
    );

    if (!boundary) {
      return null;
    }

    return boundary;
  }

  async saveBoundary(input: {
    territoryId: string;
    scope: ScopeContext;
    geoJson: GeoJsonGeometry;
  }) {
    const territory = await this.assertWritableBoundary(input.territoryId, input.scope);

    const resolution = await applyTerritoryBoundary(
      {
        territoryRepository: this.deps.territoryRepository,
        territoryTypeRepository: this.deps.territoryTypeRepository,
        spatialRepository: this.deps.spatialRepository,
        geoParentService: this.deps.geoParentService,
        geoMembershipService: this.deps.geoMembershipService,
        onBoundaryChanged: this.deps.onBoundaryChanged,
      },
      territory,
      input.geoJson
    );

    return serializeBoundaryResolution(resolution);
  }

  async deleteBoundary(input: { territoryId: string; scope: ScopeContext }) {
    const territory = await this.assertWritableBoundary(input.territoryId, input.scope);

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (type?.canHaveBoundary) {
      throw new OperationNotAllowedError(
        "delete_boundary",
        "Territories of this type must keep a geographic boundary"
      );
    }

    await this.deps.spatialRepository.deleteBoundary(input.territoryId);

    if (type?.assignsClinics) {
      await this.deps.onBoundaryChanged?.(input.territoryId);
    }

    return { success: true };
  }

  private async assertReadable(territoryId: string, scope: ScopeContext): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    await assertManagerReadableTerritory(
      scope,
      territoryId,
      this.deps.closureRepository
    );
  }

  private async assertWritableBoundary(territoryId: string, scope: ScopeContext) {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    if (!territory.isActive) {
      throw new OperationNotAllowedError("save_boundary", "Territory is not active");
    }

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type || !this.hierarchyValidator.canHaveBoundary(type)) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "This territory type cannot have a boundary"
      );
    }

    if (!scope.isGlobal) {
      await assertLeafTerritoryInJurisdiction({
        scope,
        territoryRepository: this.deps.territoryRepository,
        territoryId,
        operation: "save_boundary",
      });
    }

    return territory;
  }
}
