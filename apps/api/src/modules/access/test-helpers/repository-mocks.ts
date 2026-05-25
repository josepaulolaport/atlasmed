import { mock } from "bun:test";
import type { InviteRepository } from "../application/interfaces/invite.repository.interface";
import type { SessionRepository } from "../application/interfaces/session.repository.interface";
import type { UserRepository } from "../application/interfaces/user.repository.interface";
import type { PasswordResetRepository } from "../application/interfaces/password-reset.repository.interface";

export function createMockInviteRepository(overrides?: Partial<InviteRepository>): InviteRepository {
  return {
    create: mock(() => Promise.resolve({} as any)),
    findValidByTokenHash: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(null)),
    findByEmailOrPhone: mock(() => Promise.resolve(null)),
    markAccepted: mock(() => Promise.resolve()),
    revoke: mock(() => Promise.resolve()),
    cleanupExpired: mock(() => Promise.resolve(0)),
    acceptInviteTransaction: mock(() => Promise.resolve({ user: {}, invite: {} } as any)),
    ...overrides,
  };
}

export function createMockSessionRepository(overrides?: Partial<SessionRepository>): SessionRepository {
  return {
    create: mock(() => Promise.resolve({} as any)),
    findActiveByTokenHash: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(null)),
    findByUserId: mock(() => Promise.resolve([])),
    revoke: mock(() => Promise.resolve()),
    revokeAllByUserId: mock(() => Promise.resolve()),
    updateLastSeen: mock(() => Promise.resolve()),
    rotateSessionTransaction: mock(() => Promise.resolve({} as any)),
    ...overrides,
  };
}

export function createMockUserRepository(overrides?: Partial<UserRepository>): UserRepository {
  return {
    findByIdentifier: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({} as any)),
    updateLastLogin: mock(() => Promise.resolve()),
    updatePassword: mock(() => Promise.resolve()),
    deactivate: mock(() => Promise.resolve()),
    activate: mock(() => Promise.resolve()),
    suspend: mock(() => Promise.resolve()),
    unsuspend: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve()),
    resetPasswordTransaction: mock(() => Promise.resolve({ user: {}, passwordReset: {} } as any)),
    ...overrides,
  };
}

export function createMockPasswordResetRepository(overrides?: Partial<PasswordResetRepository>): PasswordResetRepository {
  return {
    create: mock(() => Promise.resolve({} as any)),
    findByToken: mock(() => Promise.resolve(null)),
    markAsUsed: mock(() => Promise.resolve()),
    deleteExpired: mock(() => Promise.resolve()),
    ...overrides,
  };
}
