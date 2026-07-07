import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryHierarchyPort } from "../interfaces/territory-hierarchy.port.interface";
import { isGroupingHierarchyType } from "../constants/territory-roles.constants";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";

function groupClinicsByTerritoryId(
  facilities: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    territoryId: string;
  }>
) {
  const grouped = new Map<
    string,
    Array<{ id: string; name: string; lat: number; lng: number }>
  >();

  for (const facility of facilities) {
    const bucket = grouped.get(facility.territoryId) ?? [];
    bucket.push({
      id: facility.id,
      name: facility.name,
      lat: facility.lat,
      lng: facility.lng,
    });
    grouped.set(facility.territoryId, bucket);
  }

  return grouped;
}

export class TerritoryCoverageUseCases {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      territoryTypeRepository: TerritoryTypeRepository;
      spatialRepository: TerritorySpatialRepository;
      closureRepository: TerritoryClosureRepository;
      hierarchyPort: TerritoryHierarchyPort;
    }
  ) {}

  async getAnalyticsView(input: {
    groupingTerritoryId: string;
    scope: ScopeContext;
  }) {
    const grouping = await this.assertReadableGrouping(
      input.groupingTerritoryId,
      input.scope
    );

    const scopedRepPatchIds = await this.resolveScopedRepPatchIds(input.scope);

    const [boundary, clinics] = await Promise.all([
      this.deps.spatialRepository.getBoundaryAsGeoJson(input.groupingTerritoryId),
      this.deps.spatialRepository.findAssignedClinicsInGroupingTerritory({
        groupingTerritoryId: input.groupingTerritoryId,
        scopedPatchIds: scopedRepPatchIds,
      }),
    ]);

    const clinicsByPatch = groupClinicsByTerritoryId(clinics);
    const patchIdsInResult = [...new Set(clinics.map((clinic) => clinic.territoryId))];

    const patches = await Promise.all(
      patchIdsInResult.map(async (patchId) => {
        const patch = await this.deps.territoryRepository.findById(patchId);
        return {
          repPatchId: patchId,
          repPatch: patch
            ? {
                id: patch.id,
                name: patch.name,
                code: patch.code,
                slug: patch.slug,
              }
            : null,
          facilities: clinicsByPatch.get(patchId) ?? [],
        };
      })
    );

    return {
      grouping: {
        id: grouping.id,
        name: grouping.name,
        slug: grouping.slug,
        code: grouping.code,
        boundary,
      },
      patches,
      clinicCount: clinics.length,
      patchCount: patches.length,
    };
  }

  private async resolveScopedRepPatchIds(scope: ScopeContext): Promise<string[]> {
    if (scope.isGlobal) {
      return (
        await this.deps.territoryRepository.findActiveByTypeSlug("patch")
      ).map((territory) => territory.id);
    }

    const patchTerritories = await this.deps.territoryRepository.findByIds(
      scope.effectiveTerritoryIds
    );

    return patchTerritories
      .filter((territory) => territory.territoryType?.assignsClinics)
      .map((territory) => territory.id);
  }

  private async assertReadableGrouping(groupingTerritoryId: string, scope: ScopeContext) {
    const grouping = await this.deps.territoryRepository.findById(groupingTerritoryId);
    if (!grouping) {
      throw new ResourceNotFoundError("Territory", groupingTerritoryId);
    }

    const type =
      grouping.territoryType ??
      (await this.deps.territoryTypeRepository.findById(grouping.territoryTypeId));
    if (!type || !isGroupingHierarchyType(type)) {
      throw new OperationNotAllowedError(
        "analytics_view",
        "Analytics view is only available for grouping hierarchy territories"
      );
    }

    if (!scope.isGlobal) {
      await assertManagerReadableTerritory(
        scope,
        groupingTerritoryId,
        this.deps.closureRepository
      );
    }

    return grouping;
  }
}
