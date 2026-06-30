import { mock } from "bun:test";
import type { IAuthCache } from "../application/interfaces/auth-cache.interface";
import type { ISessionCache } from "../application/interfaces/session-cache.interface";
import type { ScopeService } from "../application/services/scope.service";

export function createMockAuthCache(overrides?: Partial<IAuthCache>): IAuthCache {
  return {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve()),
    invalidate: mock(() => Promise.resolve()),
    invalidateMultiple: mock(() => Promise.resolve()),
    exists: mock(() => Promise.resolve(false)),
    isRecentlyValidated: mock(() => Promise.resolve(false)),
    markValidated: mock(() => Promise.resolve()),
    ...overrides,
  };
}

export function createMockSessionCache(overrides?: Partial<ISessionCache>): ISessionCache {
  return {
    getById: mock(() => Promise.resolve(null)),
    getByTokenHash: mock(() => Promise.resolve(null)),
    getSupersededSession: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve()),
    invalidate: mock(() => Promise.resolve()),
    invalidateByUserId: mock(() => Promise.resolve()),
    updateLastSeen: mock(() => Promise.resolve()),
    updateAfterRefresh: mock(() => Promise.resolve()),
    isMarkedRevoked: mock(() => Promise.resolve(false)),
    isRecentlyValidated: mock(() => Promise.resolve(false)),
    markValidated: mock(() => Promise.resolve()),
    ...overrides,
  };
}

export function createMockScopeService(overrides?: Partial<ScopeService>): ScopeService {
  return {
    resolve: mock(() => Promise.resolve({
      isGlobal: true,
      territoryIds: [],
      facilityIds: [],
      managedUserIds: [],
      isOperationallyActive: true,
    })),
    invalidate: mock(() => Promise.resolve()),
    invalidateForTerritoryAssignmentChange: mock(() => Promise.resolve()),
    invalidateForManagerChange: mock(() => Promise.resolve()),
    ...overrides,
  } as ScopeService;
}
