import type { ScopeContext } from "@atlasmed/access";
import { Role, createEmptyScopeContext, createGlobalScopeContext } from "@atlasmed/access";
import type {
  ScopeRepository,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";

export interface ScopeResolverDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
}

export class ScopeResolver {
  constructor(private readonly deps: ScopeResolverDependencies) {}

  async resolve(userId: string, roleName: string): Promise<ScopeContext> {
    if (roleName === Role.ADMIN) {
      return createGlobalScopeContext();
    }

    if (roleName === Role.USER) {
      const territoryIds = await this.deps.scopeRepository.findTerritoryIdsByUserId(userId);
      const clinicIds = await this.deps.territoryScopePort.getClinicIdsForTerritories(territoryIds);

      return {
        isGlobal: false,
        territoryIds,
        clinicIds,
        managedUserIds: [],
        isOperationallyActive: territoryIds.length > 0,
      };
    }

    if (roleName === Role.MANAGER) {
      const managedUserIds = await this.deps.scopeRepository.findManagedUserIds(userId);
      const territoryIds =
        managedUserIds.length > 0
          ? await this.deps.scopeRepository.findTerritoryIdsByUserIds(managedUserIds)
          : [];
      const clinicIds = await this.deps.territoryScopePort.getClinicIdsForTerritories(territoryIds);

      return {
        isGlobal: false,
        territoryIds: [...new Set(territoryIds)],
        clinicIds: [...new Set(clinicIds)],
        managedUserIds,
        isOperationallyActive: managedUserIds.length > 0 && territoryIds.length > 0,
      };
    }

    return createEmptyScopeContext();
  }
}
