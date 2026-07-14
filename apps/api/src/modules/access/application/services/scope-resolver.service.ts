import type { ScopeContext } from "@atlasmed/access";
import { Role, createEmptyScopeContext, createGlobalScopeContext, withTerritoryScopeAliases } from "@atlasmed/access";
import type {
  ScopeRepository,
  TerritoryHierarchyPort,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";
import { tracer } from "../../../../infrastructure/tracing/tracer";

export interface ScopeResolverDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
  territoryHierarchyPort: TerritoryHierarchyPort;
}

export class ScopeResolver {
  constructor(private readonly deps: ScopeResolverDependencies) {}

  async resolve(userId: string, roleName: string): Promise<ScopeContext> {
    return tracer.with(
      "scope.resolve",
      async () => this.resolveScope(userId, roleName),
      { "user.id": userId, "app.module": "access" }
    );
  }

  private async resolveScope(userId: string, roleName: string): Promise<ScopeContext> {
    if (roleName === Role.ADMIN) {
      return createGlobalScopeContext();
    }

    if (roleName === Role.REP) {
      const assignedTerritoryIds =
        await this.deps.scopeRepository.findTerritoryIdsByUserId(userId);
      const effectiveTerritoryIds =
        await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
          assignedTerritoryIds,
          true
        );
      const facilityIds =
        await this.deps.territoryScopePort.getFacilityIdsForTerritories(
          effectiveTerritoryIds
        );

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds,
        effectiveTerritoryIds,
        analyticsEffectiveTerritoryIds: effectiveTerritoryIds,
        facilityIds,
        analyticsFacilityIds: facilityIds,
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
          ? await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
              ownAssignments,
              true
            )
          : reportAssignments.length > 0
            ? await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
                reportAssignments,
                true
              )
            : [];

      const analyticsEffectiveTerritoryIds =
        reportAssignments.length > 0
          ? await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
              reportAssignments,
              true
            )
          : [];

      const oversightClinicIds =
        oversightTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(
              oversightTerritoryIds
            )
          : [];

      const analyticsFacilityIds =
        analyticsEffectiveTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(
              analyticsEffectiveTerritoryIds
            )
          : [];

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds: ownAssignments,
        effectiveTerritoryIds: oversightTerritoryIds,
        analyticsEffectiveTerritoryIds,
        facilityIds: [...new Set(oversightClinicIds)],
        analyticsFacilityIds: [...new Set(analyticsFacilityIds)],
        managedUserIds,
        reportAssignedTerritoryIds: reportAssignments,
        isOperationallyActive:
          managedUserIds.length > 0 &&
          (oversightTerritoryIds.length > 0 || analyticsEffectiveTerritoryIds.length > 0),
      });
    }

    if (roleName === Role.OPS) {
      return createGlobalScopeContext();
    }

    return createEmptyScopeContext();
  }
}
