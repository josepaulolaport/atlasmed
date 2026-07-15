import type { ScopeContext } from '@atlasmed/access'
import {
  createEmptyScopeContext,
  createGlobalScopeContext,
  Role,
  withTerritoryScopeAliases
} from '@atlasmed/access'
import { tracer } from '../../../../infrastructure/tracing/tracer'
import type {
  ScopeRepository,
  TerritoryHierarchyPort,
  TerritoryScopePort
} from '../interfaces/scope.repository.interface'

export interface ScopeResolverDependencies {
  scopeRepository: ScopeRepository
  territoryScopePort: TerritoryScopePort
  territoryHierarchyPort: TerritoryHierarchyPort
}

export class ScopeResolver {
  constructor(private readonly deps: ScopeResolverDependencies) {}

  async resolve(userId: string, roleName: string): Promise<ScopeContext> {
    return tracer.with('scope.resolve', async () => this.resolveScope(userId, roleName), {
      'user.id': userId,
      'app.module': 'access'
    })
  }

  private async resolveScope(userId: string, roleName: string): Promise<ScopeContext> {
    if (roleName === Role.ADMIN) {
      return createGlobalScopeContext()
    }

    if (roleName === Role.REP) {
      const [assignedSectorIds, rawTerritoryIds] = await Promise.all([
        this.deps.scopeRepository.findSectorIdsByUserId(userId),
        this.deps.scopeRepository.findTerritoryIdsByUserId(userId)
      ])

      const assignedTerritoryIds = await this.applySectorFilter(rawTerritoryIds, assignedSectorIds)

      const effectiveTerritoryIds =
        await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
          assignedTerritoryIds,
          true
        )
      const facilityIds =
        await this.deps.territoryScopePort.getFacilityIdsForTerritories(effectiveTerritoryIds)

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds,
        effectiveTerritoryIds,
        analyticsEffectiveTerritoryIds: effectiveTerritoryIds,
        facilityIds,
        analyticsFacilityIds: facilityIds,
        managedUserIds: [],
        assignedSectorIds,
        isOperationallyActive: effectiveTerritoryIds.length > 0
      })
    }

    if (roleName === Role.MANAGER) {
      const [assignedSectorIds, managedUserIds, rawOwnAssignments] = await Promise.all([
        this.deps.scopeRepository.findSectorIdsByUserId(userId),
        this.deps.scopeRepository.findManagedUserIds(userId),
        this.deps.scopeRepository.findTerritoryIdsByUserId(userId)
      ])

      const ownAssignments = await this.applySectorFilter(rawOwnAssignments, assignedSectorIds)

      const reportAssignments =
        managedUserIds.length > 0
          ? await this.deps.scopeRepository.findTerritoryIdsByUserIds(managedUserIds)
          : []

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
            : []

      const analyticsEffectiveTerritoryIds =
        reportAssignments.length > 0
          ? await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
              reportAssignments,
              true
            )
          : []

      const oversightClinicIds =
        oversightTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(oversightTerritoryIds)
          : []

      const analyticsFacilityIds =
        analyticsEffectiveTerritoryIds.length > 0
          ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(
              analyticsEffectiveTerritoryIds
            )
          : []

      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds: ownAssignments,
        effectiveTerritoryIds: oversightTerritoryIds,
        analyticsEffectiveTerritoryIds,
        facilityIds: [...new Set(oversightClinicIds)],
        analyticsFacilityIds: [...new Set(analyticsFacilityIds)],
        managedUserIds,
        reportAssignedTerritoryIds: reportAssignments,
        assignedSectorIds,
        isOperationallyActive:
          managedUserIds.length > 0 &&
          (oversightTerritoryIds.length > 0 || analyticsEffectiveTerritoryIds.length > 0)
      })
    }

    if (roleName === Role.OPS) {
      return createGlobalScopeContext()
    }

    return createEmptyScopeContext()
  }

  /**
   * Intersects territory IDs with the user's assigned sectors.
   * Falls back to all territory IDs when the user has no sector assignments,
   * preserving backward-compatible behavior for users without sectors.
   */
  private async applySectorFilter(territoryIds: string[], sectorIds: string[]): Promise<string[]> {
    if (sectorIds.length === 0 || territoryIds.length === 0) {
      return territoryIds
    }

    const sectorTerritoryIds =
      await this.deps.scopeRepository.findTerritoryIdsBySectorIds(sectorIds)
    const allowed = new Set(sectorTerritoryIds)
    return territoryIds.filter((id) => allowed.has(id))
  }
}
