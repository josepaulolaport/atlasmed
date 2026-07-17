import type { ScopeContext } from "@atlasmed/access";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";
import { applyTerritoryBoundary } from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";
import { assertTerritorialJurisdiction } from "../services/territory-scope-policy.service";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: string) => Promise<void>;
}

export class TerritoryBoundaryUseCases {
  constructor(private readonly deps: Dependencies) {}

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
        containmentService: this.deps.containmentService,
        onBoundaryChanged: this.deps.onBoundaryChanged,
        onManagerTerritoryChanged: this.deps.onManagerTerritoryChanged,
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

    assertManagerReadableTerritory(scope, territoryId);
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
    if (!type || !type.canHaveBoundary) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "This territory type cannot have a boundary"
      );
    }

    assertTerritorialJurisdiction(scope, territoryId, "save_boundary");

    return territory;
  }
}
