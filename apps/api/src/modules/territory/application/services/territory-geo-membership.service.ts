import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritoryGeoMembershipRepository } from "../interfaces/territory-geo-membership.repository.interface";
import {
  GEO_MEMBERSHIP_MIN_OVERLAP_RATIO,
  isOperationalTerritoryType,
} from "../constants/territory-geo-membership.constants";
import { OperationNotAllowedError } from "../../../../shared/errors";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  geoMembershipRepository: TerritoryGeoMembershipRepository;
}

export interface GeoMembershipRebuildResult {
  operationalTerritoryId: string;
  membershipCount: number;
  referenceTerritoryIds: string[];
}

export class TerritoryGeoMembershipService {
  constructor(private readonly deps: Dependencies) {}

  async rebuildForOperationalTerritory(territoryId: string): Promise<GeoMembershipRebuildResult> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new OperationNotAllowedError("rebuild_geo_membership", "Territory not found");
    }

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type || !isOperationalTerritoryType(type)) {
      throw new OperationNotAllowedError(
        "rebuild_geo_membership",
        "Geo membership is only computed for operational territory types"
      );
    }

    const countryCode = territory.countryCode ?? "BR";

    await this.deps.territoryRepository.update(territoryId, {
      geoMembershipStatus: "pending",
    });

    try {
      const candidates = await this.deps.geoMembershipRepository.computeCandidates({
        operationalTerritoryId: territoryId,
        countryCode,
        minOverlapRatio: GEO_MEMBERSHIP_MIN_OVERLAP_RATIO,
      });

      await this.deps.geoMembershipRepository.deleteForOperationalTerritory(territoryId);
      await this.deps.geoMembershipRepository.insertRows(
        candidates.map((candidate) => ({
          operationalTerritoryId: territoryId,
          referenceTerritoryId: candidate.referenceTerritoryId,
          referenceTypeSlug: candidate.referenceTypeSlug,
          overlapRatio: candidate.overlapRatio,
          intersectionAreaSqKm: candidate.intersectionAreaSqKm,
        }))
      );

      await this.deps.territoryRepository.update(territoryId, {
        geoMembershipStatus: "ready",
        parentAssignmentStatus: "resolved",
        parentAssignmentSource: "manual",
      });

      return {
        operationalTerritoryId: territoryId,
        membershipCount: candidates.length,
        referenceTerritoryIds: candidates.map((candidate) => candidate.referenceTerritoryId),
      };
    } catch (error) {
      await this.deps.territoryRepository.update(territoryId, {
        geoMembershipStatus: "failed",
      });
      throw error;
    }
  }

  async clearForOperationalTerritory(territoryId: string): Promise<void> {
    await this.deps.geoMembershipRepository.deleteForOperationalTerritory(territoryId);
    await this.deps.territoryRepository.update(territoryId, {
      geoMembershipStatus: null,
    });
  }
}
