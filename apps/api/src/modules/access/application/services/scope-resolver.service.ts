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
        analyticsEffectiveTerritoryIds: effectiveTerritoryIds,
        clinicIds,
        analyticsClinicIds: clinicIds,
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

      const oversightTerritoryIds =
        ownAssignments.length > 0
          ? await this.deps.territoryHierarchyPort.resolveDescendantIds(
              ownAssignments,
              true
            )
          : reportAssignments.length > 0
            ? await this.deps.territoryHierarchyPort.resolveDescendantIds(
                reportAssignments,
                true
              )
            : [];

      const analyticsEffectiveTerritoryIds =
        reportAssignments.length > 0
          ? await this.deps.territoryHierarchyPort.resolveDescendantIds(
              reportAssignments,
              true
            )
          : [];

      const oversightClinicIds =
        oversightTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getClinicIdsForTerritories(
              oversightTerritoryIds
            )
          : [];

      const analyticsClinicIds =
        analyticsEffectiveTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getClinicIdsForTerritories(
              analyticsEffectiveTerritoryIds
            )
          : [];

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds: ownAssignments,
        effectiveTerritoryIds: oversightTerritoryIds,
        analyticsEffectiveTerritoryIds,
        clinicIds: [...new Set(oversightClinicIds)],
        analyticsClinicIds: [...new Set(analyticsClinicIds)],
        managedUserIds,
        reportAssignedTerritoryIds: reportAssignments,
        isOperationallyActive:
          managedUserIds.length > 0 &&
          (oversightTerritoryIds.length > 0 || analyticsEffectiveTerritoryIds.length > 0),
      });
    }

    return createEmptyScopeContext();
  }
}
