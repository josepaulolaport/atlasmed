import type { TerritoryScopePort } from "../../../access/application/interfaces/scope.repository.interface";
import type { FacilityRepository } from "../../application/interfaces/facility.repository.interface";

export class DrizzleTerritoryScopePort implements TerritoryScopePort {
  constructor(private readonly facilityRepository: FacilityRepository) {}

  async getFacilityIdsForTerritories(territoryIds: number[]): Promise<number[]> {
    return this.facilityRepository.findIdsByTerritoryIds(territoryIds);
  }

  async getFacilityIdsForVerticals(verticalIds: number[]): Promise<number[]> {
    return this.facilityRepository.findActiveFacilityIdsByVerticalIds(verticalIds);
  }
}
