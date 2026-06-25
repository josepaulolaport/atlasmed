import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritoryGeoMembershipRepository } from "../interfaces/territory-geo-membership.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import {
  isReferenceMembershipTarget,
} from "../constants/territory-geo-membership.constants";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadScope } from "./territory-crud.use-cases";

function groupClinicsByTerritoryId(
  clinics: Array<{
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

  for (const clinic of clinics) {
    const bucket = grouped.get(clinic.territoryId) ?? [];
    bucket.push({
      id: clinic.id,
      name: clinic.name,
      lat: clinic.lat,
      lng: clinic.lng,
    });
    grouped.set(clinic.territoryId, bucket);
  }

  return grouped;
}

export class TerritoryCoverageUseCases {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      territoryTypeRepository: TerritoryTypeRepository;
      geoMembershipRepository: TerritoryGeoMembershipRepository;
      spatialRepository: TerritorySpatialRepository;
    }
  ) {}

  async getReferenceCoverage(input: { referenceTerritoryId: string; scope: ScopeContext }) {
    const reference = await this.assertReadableReference(input.referenceTerritoryId, input.scope);

    const [boundary, memberships, clinics] = await Promise.all([
      this.deps.spatialRepository.getBoundaryAsGeoJson(input.referenceTerritoryId),
      this.deps.geoMembershipRepository.listByReferenceTerritoryId(input.referenceTerritoryId),
      this.deps.spatialRepository.findAssignedClinicsInReferenceTerritory(
        input.referenceTerritoryId
      ),
    ]);

    const clinicsByPatch = groupClinicsByTerritoryId(clinics);

    const patches = await Promise.all(
      memberships.map(async (membership) => {
        const clippedBoundary = await this.deps.spatialRepository.getClippedBoundaryAsGeoJson(
          membership.operationalTerritoryId,
          input.referenceTerritoryId
        );

        return {
          operationalTerritoryId: membership.operationalTerritoryId,
          operationalTerritory: membership.operationalTerritory,
          overlapRatio: membership.overlapRatio,
          intersectionAreaSqKm: membership.intersectionAreaSqKm,
          clippedBoundary,
          clinics: clinicsByPatch.get(membership.operationalTerritoryId) ?? [],
        };
      })
    );

    return {
      reference: {
        id: reference.id,
        name: reference.name,
        slug: reference.slug,
        code: reference.code,
        boundary,
      },
      patches,
      clinicCount: clinics.length,
      patchCount: patches.length,
    };
  }

  private async assertReadableReference(referenceTerritoryId: string, scope: ScopeContext) {
    const reference = await this.deps.territoryRepository.findById(referenceTerritoryId);
    if (!reference) {
      throw new ResourceNotFoundError("Territory", referenceTerritoryId);
    }

    const type =
      reference.territoryType ??
      (await this.deps.territoryTypeRepository.findById(reference.territoryTypeId));
    if (!type || !isReferenceMembershipTarget(type)) {
      throw new OperationNotAllowedError(
        "coverage_view",
        "Coverage view is only available for state and municipality reference territories"
      );
    }

    if (!scope.isGlobal) {
      assertManagerReadScope(scope, referenceTerritoryId);
    }

    return reference;
  }
}
