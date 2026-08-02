import type { ScopeContext } from "@atlasmed/access";
import { Role, createEmptyScopeContext, createGlobalScopeContext, withTerritoryScopeAliases } from "@atlasmed/access";
import type {
  FacilityAssociationPort,
  ScopeRepository,
  TerritoryHierarchyPort,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";
import { tracer } from "../../../../infrastructure/tracing/tracer";

export interface ScopeResolverDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
  territoryHierarchyPort: TerritoryHierarchyPort;
  facilityAssociationPort: FacilityAssociationPort;
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
      // Prefer explicit user_vertical_assignments (derm-only admin, etc.).
      // Fallback: all active verticals when admin has no UVA rows yet.
      const fromAssignments =
        await this.deps.scopeRepository.findVerticalIdsByUserId(userId);
      const assignedVerticalIds =
        fromAssignments.length > 0
          ? fromAssignments
          : (await this.deps.scopeRepository.listActiveVerticals()).map((v) => v.id);
      return withTerritoryScopeAliases({
        ...createGlobalScopeContext(),
        assignedVerticalIds,
      });
    }

    if (roleName === Role.MANAGER) {
      return this.resolveManagerScope(userId);
    }

    if (roleName === Role.REP) {
      return this.resolveRepScope(userId);
    }

    if (roleName === Role.OPS) {
      return this.resolveOpsScope(userId);
    }

    return createEmptyScopeContext();
  }

  /** REP: patches for org/map; clinic list = consultant assigns only (Q4). */
  private async resolveRepScope(userId: string): Promise<ScopeContext> {
    const [assignedVerticalIds, rawTerritoryIds] = await Promise.all([
      this.deps.scopeRepository.findVerticalIdsByUserId(userId),
      this.deps.scopeRepository.findTerritoryIdsByUserId(userId),
    ]);

    const assignedTerritoryIds = rawTerritoryIds;
    const effectiveTerritoryIds =
      await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
        assignedTerritoryIds,
        true
      );
    const facilityIds = await this.mergeAssociatedFacilityIds(
      userId,
      [],
      assignedVerticalIds,
    );

    return withTerritoryScopeAliases({
      isGlobal: false,
      assignedTerritoryIds,
      effectiveTerritoryIds,
      analyticsEffectiveTerritoryIds: effectiveTerritoryIds,
      facilityIds,
      analyticsFacilityIds: facilityIds,
      managedUserIds: [],
      assignedVerticalIds,
      isOperationallyActive:
        effectiveTerritoryIds.length > 0 || facilityIds.length > 0,
    });
  }

  /** OPS: all profiled facilities in assigned verticals; no zone cover (Q4c). */
  private async resolveOpsScope(userId: string): Promise<ScopeContext> {
    const [assignedVerticalIds, rawTerritoryIds] = await Promise.all([
      this.deps.scopeRepository.findVerticalIdsByUserId(userId),
      this.deps.scopeRepository.findTerritoryIdsByUserId(userId),
    ]);

    const assignedTerritoryIds = rawTerritoryIds;
    const effectiveTerritoryIds =
      await this.deps.territoryHierarchyPort.resolveEffectiveTerritoryIds(
        assignedTerritoryIds,
        true
      );

    const facilityIds =
      assignedVerticalIds.length > 0
        ? await this.deps.territoryScopePort.getFacilityIdsForVerticals(
            assignedVerticalIds,
          )
        : [];

    return withTerritoryScopeAliases({
      isGlobal: false,
      assignedTerritoryIds,
      effectiveTerritoryIds,
      analyticsEffectiveTerritoryIds: effectiveTerritoryIds,
      facilityIds,
      analyticsFacilityIds: facilityIds,
      managedUserIds: [],
      assignedVerticalIds,
      isOperationallyActive: facilityIds.length > 0 || assignedVerticalIds.length > 0,
    });
  }

  private async resolveManagerScope(userId: string): Promise<ScopeContext> {
    const [assignedVerticalIds, managedUserIds, ownAssignments] = await Promise.all([
      this.deps.scopeRepository.findVerticalIdsByUserId(userId),
      this.deps.scopeRepository.findManagedUserIds(userId),
      this.deps.scopeRepository.findTerritoryIdsByUserId(userId),
    ]);

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

    // Spec 0006: clinic membership is on manager zones. Do not expand zone→patches
    // for clinic id resolution (patches no longer hold membership FKs).
    const oversightZoneIds =
      ownAssignments.length > 0 ? ownAssignments : [];

    const oversightClinicIds =
      oversightZoneIds.length > 0
        ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(
            oversightZoneIds
          )
        : [];
    const facilityIds = await this.mergeAssociatedFacilityIds(
      userId,
      oversightClinicIds,
      assignedVerticalIds,
    );

    // Analytics still uses report patch expansion for map/territory rollups;
    // clinic analytics set uses zones derived from report patch parents when needed.
    const analyticsFacilityIds =
      oversightZoneIds.length > 0
        ? await this.deps.territoryScopePort.getFacilityIdsForTerritories(
            oversightZoneIds
          )
        : [];

    return withTerritoryScopeAliases({
      isGlobal: false,
      assignedTerritoryIds: ownAssignments,
      effectiveTerritoryIds: oversightTerritoryIds,
      analyticsEffectiveTerritoryIds,
      facilityIds,
      analyticsFacilityIds: [...new Set(analyticsFacilityIds)],
      managedUserIds,
      reportAssignedTerritoryIds: reportAssignments,
      oversightZoneIds,
      assignedVerticalIds,
      isOperationallyActive:
        facilityIds.length > 0 ||
        oversightZoneIds.length > 0 ||
        (managedUserIds.length > 0 &&
          (oversightTerritoryIds.length > 0 ||
            analyticsEffectiveTerritoryIds.length > 0)),
    });
  }

  /** Territory clinics ∪ active facility_consultant_assignments for the user. */
  private async mergeAssociatedFacilityIds(
    userId: string,
    territoryFacilityIds: string[],
    verticalIds: string[],
  ): Promise<string[]> {
    const associated =
      await this.deps.facilityAssociationPort.getAssociatedFacilityIds(
        userId,
        verticalIds.length > 0 ? verticalIds : undefined,
      );
    return [...new Set([...territoryFacilityIds, ...associated])];
  }
}
