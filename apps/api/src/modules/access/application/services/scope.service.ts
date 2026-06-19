import { mergeGrantsIntoScope, type ScopeContext } from "@atlasmed/access";
import type { ScopeRepository, TerritoryScopePort } from "../interfaces/scope.repository.interface";
import { ScopeResolver } from "./scope-resolver.service";
import { scopeCacheService } from "../../infrastructure/cache/scope-cache.service";
import type { AccessGrantService } from "./access-grant.service";

interface ScopeServiceDependencies {
  scopeRepository: ScopeRepository;
  territoryScopePort: TerritoryScopePort;
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

  async resolve(userId: string, roleName: string): Promise<ScopeContext> {
    let scope = await scopeCacheService.get(userId);

    if (!scope) {
      scope = await this.scopeResolver.resolve(userId, roleName);
      await scopeCacheService.set(userId, scope);
    }

    const grants = await this.accessGrantService.getActiveGrants(userId);
    return mergeGrantsIntoScope(scope, grants);
  }

  async invalidate(userId: string): Promise<void> {
    await scopeCacheService.invalidate(userId);
  }

  async invalidateForTerritoryAssignmentChange(userId: string): Promise<void> {
    const userIdsToInvalidate = new Set<string>([userId]);
    const managerId = await this.scopeRepository.findManagerIdByUserId(userId);

    if (managerId) {
      userIdsToInvalidate.add(managerId);
    }

    await scopeCacheService.invalidateMany([...userIdsToInvalidate]);
  }

  async invalidateForManagerChange(params: {
    userId: string;
    previousManagerId?: string | null;
    nextManagerId?: string | null;
  }): Promise<void> {
    const userIdsToInvalidate = new Set<string>([params.userId]);

    if (params.previousManagerId) {
      userIdsToInvalidate.add(params.previousManagerId);
    }

    if (params.nextManagerId) {
      userIdsToInvalidate.add(params.nextManagerId);
    }

    await scopeCacheService.invalidateMany([...userIdsToInvalidate]);
  }
}
