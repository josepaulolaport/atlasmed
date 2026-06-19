import type { TerritoryScopePort } from "../../application/interfaces/scope.repository.interface";
import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";

/**
 * Stub until clinic module implements TerritoryScopePort.
 *
 * Implementation checklist (clinic module):
 * - [ ] Query clinic IDs by territory IDs from clinic/territory tables
 * - [ ] Wire PrismaClinicTerritoryScopePort in composition.ts
 * - [ ] Integration tests: USER scope receives non-empty clinicIds when assigned territories have clinics
 */
export class StubTerritoryScopePort implements TerritoryScopePort {
  async getClinicIdsForTerritories(territoryIds: string[]): Promise<string[]> {
    if (territoryIds.length > 0) {
      console.warn("[StubTerritoryScopePort] clinicIds unresolved for territories", {
        territoryCount: territoryIds.length,
        territoryIds: territoryIds.slice(0, 5),
      });
      metricsService.recordScopeClinicResolutionStub(territoryIds.length);
    }

    return [];
  }
}
