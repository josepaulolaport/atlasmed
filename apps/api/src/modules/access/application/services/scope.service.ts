import { mergeGrantsIntoScope, type ScopeContext } from "@atlasmed/access";
import type {
  FacilityAssociationPort,
  ScopeRepository,
  TerritoryHierarchyPort,
  TerritoryScopePort,
} from "../interfaces/scope.repository.interface";
import { ScopeResolver } from "./scope-resolver.service";
import { scopeCacheService } from "../../infrastructure/cache/scope-cache.service";
import type { AccessGrantService } from "./access-grant.service";

interface ScopeServiceDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
  territoryHierarchyPort: TerritoryHierarchyPort;
  facilityAssociationPort: FacilityAssociationPort;
  accessGrantService: AccessGrantService;
}

export class ScopeService {
  private readonly scopeResolver: ScopeResolver;
  private readonly scopeRepository: ScopeRepository;
  private readonly accessGrantService: AccessGrantService;

  constructor(deps: ScopeServiceDependencies) {
    this.scopeRepository = deps.scopeRepository;
    this.scopeResolver = new ScopeResolver(deps);
    this.accessGrantService = deps.accessGrantService;
  }

  async resolve(userId: number, roleName: string): Promise<ScopeContext> {
    let scope = await scopeCacheService.get(userId);

    if (!scope) {
      scope = await this.scopeResolver.resolve(userId, roleName);
      await scopeCacheService.set(userId, scope);
    }

    const grants = await this.accessGrantService.getActiveGrants(userId);
    return mergeGrantsIntoScope(scope, grants);
  }

  async invalidate(userId: number): Promise<void> {
    await scopeCacheService.invalidate(userId);
  }

  async invalidateForTerritoryAssignmentChange(userId: number): Promise<void> {
    const userIdsToInvalidate = new Set<number>([userId]);
    const managerId = await this.scopeRepository.findManagerIdByUserId(userId);

    if (managerId) {
      userIdsToInvalidate.add(managerId);
    }

    await scopeCacheService.invalidateMany([...userIdsToInvalidate]);
  }

  async invalidateForManagerChange(params: {
    userId: number;
    previousManagerId?: number | null;
    nextManagerId?: number | null;
  }): Promise<void> {
    const userIdsToInvalidate = new Set<number>([params.userId]);

    if (params.previousManagerId) {
      userIdsToInvalidate.add(params.previousManagerId);
    }

    if (params.nextManagerId) {
      userIdsToInvalidate.add(params.nextManagerId);
    }

    await scopeCacheService.invalidateMany([...userIdsToInvalidate]);
  }

  /** Consultant assignment changes expand/contract facilityIds for affected users. */
  async invalidateForConsultantAssignmentChange(userIds: number[]): Promise<void> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return;
    await scopeCacheService.invalidateMany(unique);
  }
}
