import type { TerritoryScopePort } from "../../../access/application/interfaces/scope.repository.interface";
import type { ClinicRepository } from "../../application/interfaces/clinic.repository.interface";

export class PrismaTerritoryScopePort implements TerritoryScopePort {
  constructor(private readonly clinicRepository: ClinicRepository) {}

  async getClinicIdsForTerritories(territoryIds: string[]): Promise<string[]> {
    return this.clinicRepository.findIdsByTerritoryIds(territoryIds);
  }
}
