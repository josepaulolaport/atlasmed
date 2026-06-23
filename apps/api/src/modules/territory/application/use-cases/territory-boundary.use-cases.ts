import type { ScopeContext } from "@atlasmed/access";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import { TerritoryHierarchyValidator } from "../services/territory-hierarchy-validator.service";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadScope } from "./territory-crud.use-cases";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  spatialRepository: TerritorySpatialRepository;
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
    await this.assertWritableLeaf(input.territoryId, input.scope);

    const overlaps = await this.deps.spatialRepository.findOverlappingLeaves(
      input.territoryId,
      input.geoJson
    );

    if (overlaps.length > 0) {
      throw new OperationNotAllowedError(
        "save_boundary",
        `Boundary overlaps with: ${overlaps.map((o) => o.code).join(", ")}`
      );
    }

    await this.deps.spatialRepository.saveBoundary(input.territoryId, input.geoJson);
    await this.deps.onBoundaryChanged?.(input.territoryId);

    return { success: true };
  }

  async deleteBoundary(input: { territoryId: string; scope: ScopeContext }) {
    await this.assertWritableLeaf(input.territoryId, input.scope);
    await this.deps.spatialRepository.deleteBoundary(input.territoryId);
    await this.deps.onBoundaryChanged?.(input.territoryId);
    return { success: true };
  }

  private async assertReadable(territoryId: string, scope: ScopeContext): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    if (!scope.isGlobal) {
      assertManagerReadScope(scope, territoryId);
    }
  }

  private async assertWritableLeaf(
    territoryId: string,
    scope: ScopeContext
  ): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    if (!territory.isActive) {
      throw new OperationNotAllowedError("save_boundary", "Territory is not active");
    }

    const activeChildCount =
      await this.deps.territoryRepository.countActiveChildren(territoryId);

    if (!this.hierarchyValidator.isDynamicLeaf(activeChildCount)) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "Only leaf territories can have boundaries"
      );
    }

    if (!scope.isGlobal) {
      assertManagerReadScope(scope, territoryId);
    }
  }
}
