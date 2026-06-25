import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryGeoMembershipRepository } from "../interfaces/territory-geo-membership.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { assertManagerReadScope } from "./territory-crud.use-cases";

function serializeMembership(record: {
  id: string;
  operationalTerritoryId: string;
  referenceTerritoryId: string;
  referenceTypeSlug: string;
  overlapRatio: number;
  intersectionAreaSqKm: number;
  computedAt: Date;
  operationalTerritory?: {
    id: string;
    name: string;
    slug: string;
    code: string;
    territoryType: { slug: string; name: string };
  };
}) {
  return {
    id: record.id,
    operationalTerritoryId: record.operationalTerritoryId,
    referenceTerritoryId: record.referenceTerritoryId,
    referenceTypeSlug: record.referenceTypeSlug,
    overlapRatio: record.overlapRatio,
    intersectionAreaSqKm: record.intersectionAreaSqKm,
    computedAt: record.computedAt.toISOString(),
    operationalTerritory: record.operationalTerritory,
  };
}

export class TerritoryGeoMembershipUseCases {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      geoMembershipRepository: TerritoryGeoMembershipRepository;
      spatialRepository: TerritorySpatialRepository;
    }
  ) {}

  async listOperationalMembers(input: { referenceTerritoryId: string; scope: ScopeContext }) {
    await this.assertReadable(input.referenceTerritoryId, input.scope);

    const memberships = await this.deps.geoMembershipRepository.listByReferenceTerritoryId(
      input.referenceTerritoryId
    );

    return { data: memberships.map(serializeMembership) };
  }

  async listReferenceMemberships(input: {
    operationalTerritoryId: string;
    scope: ScopeContext;
  }) {
    await this.assertReadable(input.operationalTerritoryId, input.scope);

    const memberships = await this.deps.geoMembershipRepository.listByOperationalTerritoryId(
      input.operationalTerritoryId
    );

    return {
      data: memberships.map((membership) => ({
        id: membership.id,
        referenceTerritoryId: membership.referenceTerritoryId,
        referenceTypeSlug: membership.referenceTypeSlug,
        overlapRatio: membership.overlapRatio,
        intersectionAreaSqKm: membership.intersectionAreaSqKm,
        computedAt: membership.computedAt.toISOString(),
        referenceTerritory: membership.referenceTerritory,
      })),
    };
  }

  async getClippedBoundary(input: {
    operationalTerritoryId: string;
    referenceTerritoryId: string;
    scope: ScopeContext;
  }) {
    await this.assertReadable(input.operationalTerritoryId, input.scope);
    await this.assertReadable(input.referenceTerritoryId, input.scope);

    const boundary = await this.deps.spatialRepository.getClippedBoundaryAsGeoJson(
      input.operationalTerritoryId,
      input.referenceTerritoryId
    );

    if (!boundary) {
      return null;
    }

    return boundary;
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
}
