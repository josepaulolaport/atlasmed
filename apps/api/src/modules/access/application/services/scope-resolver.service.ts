import type { ScopeContext } from "@atlasmed/access";
import { Role, createEmptyScopeContext, createGlobalScopeContext, withTerritoryScopeAliases } from "@atlasmed/access";
import type {
  ScopeRepository,
  TerritoryHierarchyPort,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";

export interface ScopeResolverDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
  territoryHierarchyPort: TerritoryHierarchyPort;
}

export class ScopeResolver {
  constructor(private readonly deps: ScopeResolverDependencies) {}

  async resolve(userId: string, roleName: string): Promise<ScopeContext> {
    if (roleName === Role.ADMIN) {
      return createGlobalScopeContext();
    }

    if (roleName === Role.USER) {
      const assignedTerritoryIds =
        await this.deps.scopeRepository.findTerritoryIdsByUserId(userId);
      const effectiveTerritoryIds =
        await this.deps.territoryHierarchyPort.resolveDescendantIds(
          assignedTerritoryIds,
          true
        );
      const clinicIds =
        await this.deps.territoryScopePort.getClinicIdsForTerritories(
          effectiveTerritoryIds
        );

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds,
        effectiveTerritoryIds,
        clinicIds,
        managedUserIds: [],
        isOperationallyActive: effectiveTerritoryIds.length > 0,
      });
    }

    if (roleName === Role.MANAGER) {
      const managedUserIds = await this.deps.scopeRepository.findManagedUserIds(userId);
      const ownAssignments =
        await this.deps.scopeRepository.findTerritoryIdsByUserId(userId);
      const reportAssignments =
        managedUserIds.length > 0
          ? await this.deps.scopeRepository.findTerritoryIdsByUserIds(managedUserIds)
          : [];

      const assignedTerritoryIds = [
        ...new Set([...ownAssignments, ...reportAssignments]),
      ];
      const effectiveTerritoryIds =
        await this.deps.territoryHierarchyPort.resolveDescendantIds(
          assignedTerritoryIds,
          true
        );
      const clinicIds =
        await this.deps.territoryScopePort.getClinicIdsForTerritories(
          effectiveTerritoryIds
        );

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds,
        effectiveTerritoryIds,
        clinicIds: [...new Set(clinicIds)],
        managedUserIds,
        isOperationallyActive:
          managedUserIds.length > 0 && effectiveTerritoryIds.length > 0,
      });
    }

    return createEmptyScopeContext();
  }
}
