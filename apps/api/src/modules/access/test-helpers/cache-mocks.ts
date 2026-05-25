import { mock } from "bun:test";
import type { IAuthCache } from "../application/interfaces/auth-cache.interface";
import type { ISessionCache } from "../application/interfaces/session-cache.interface";

export function createMockAuthCache(overrides?: Partial<IAuthCache>): IAuthCache {
  return {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve()),
    invalidate: mock(() => Promise.resolve()),
    invalidateMultiple: mock(() => Promise.resolve()),
    exists: mock(() => Promise.resolve(false)),
    ...overrides,
  };
}

export function createMockSessionCache(overrides?: Partial<ISessionCache>): ISessionCache {
  return {
    getById: mock(() => Promise.resolve(null)),
    getByTokenHash: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve()),
    invalidate: mock(() => Promise.resolve()),
    invalidateByUserId: mock(() => Promise.resolve()),
    updateLastSeen: mock(() => Promise.resolve()),
    ...overrides,
  };
}
