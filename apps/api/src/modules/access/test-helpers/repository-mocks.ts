import { mock } from "bun:test";
import type { ScopeRepository } from "../application/interfaces/scope.repository.interface";
import type { InviteRepository } from "../application/interfaces/invite.repository.interface";
import type { SessionRepository } from "../application/interfaces/session.repository.interface";
import type { UserRepository } from "../application/interfaces/user.repository.interface";
import type { PasswordResetRepository } from "../application/interfaces/password-reset.repository.interface";
import type { RoleRepository } from "../application/interfaces/role.repository.interface";
import type { VerificationTokenRepository } from "../application/interfaces/verification-token.repository.interface";
import { ROLE_PRIORITY_BY_NAME } from "../application/constants/role-priority.constants";

export function createMockScopeRepository(overrides?: Partial<ScopeRepository>): ScopeRepository {
  return {
    findTerritoryIdsByUserId: mock(() => Promise.resolve([])),
    findTerritoryIdsByUserIds: mock(() => Promise.resolve([])),
    findManagedUserIds: mock(() => Promise.resolve([])),
    assignTerritory: mock(() => Promise.resolve()),
    revokeTerritory: mock(() => Promise.resolve()),
    findTerritoryAssignmentsByUserId: mock(() => Promise.resolve([])),
    findManagerIdByUserId: mock(() => Promise.resolve(null)),
    ...overrides,
  };
}

export function createMockInviteRepository(overrides?: Partial<InviteRepository>): InviteRepository {
  return {
    create: mock(() => Promise.resolve({} as any)),
    findValidByTokenHash: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(null)),
    findByEmailOrPhone: mock(() => Promise.resolve(null)),
    findAll: mock(() => Promise.resolve({ invitations: [], total: 0 })),
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
    findSessionStatus: mock(() => Promise.resolve(null)),
    findByUserId: mock(() => Promise.resolve([])),
    revoke: mock(() => Promise.resolve()),
    revokeForSecurityViolation: mock(() => Promise.resolve()),
    revokeAllByUserId: mock(() => Promise.resolve()),
    revokeActiveByUserAndDeviceFingerprint: mock(() => Promise.resolve([])),
    revokeAllActiveForDevice: mock(() => Promise.resolve([])),
    revokeAllExceptDevice: mock(() => Promise.resolve([])),
    updateLastSeen: mock(() => Promise.resolve()),
    rotateRefreshTokenTransaction: mock(() => Promise.resolve({} as any)),
    createLoginSessionTransaction: mock(async (params) => ({
      session: {
        id: params.id,
        userId: params.userId,
        refreshTokenHash: params.refreshTokenHash,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        expiresAt: params.expiresAt,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      },
      revokedSessionIds: [],
    })),
    ...overrides,
  };
}

export function createMockUserRepository(overrides?: Partial<UserRepository>): UserRepository {
  return {
    findByIdentifier: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(null)),
    findUserAuthStatus: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({} as any)),
    updateLastLogin: mock(() => Promise.resolve()),
    updatePassword: mock(() => Promise.resolve()),
    deactivate: mock(() => Promise.resolve()),
    activate: mock(() => Promise.resolve()),
    suspend: mock(() => Promise.resolve()),
    unsuspend: mock(() => Promise.resolve()),
    updateRole: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve()),
    incrementTokenVersion: mock(() => Promise.resolve(1)),
    resetPasswordTransaction: mock(() => Promise.resolve({ user: {}, passwordReset: {} } as any)),
    findEmailVerificationState: mock(() => Promise.resolve(null)),
    findPhoneVerificationState: mock(() => Promise.resolve(null)),
    findByEmail: mock(() => Promise.resolve(null)),
    findByPhone: mock(() => Promise.resolve(null)),
    markEmailVerified: mock(() => Promise.resolve()),
    markPhoneVerified: mock(() => Promise.resolve()),
    updateEmail: mock(() => Promise.resolve()),
    updatePhone: mock(() => Promise.resolve()),
    findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    updateProfile: mock(() => Promise.resolve({} as any)),
    updateManagerId: mock(() => Promise.resolve({} as any)),
    ...overrides,
  };
}

export function createMockPasswordResetRepository(overrides?: Partial<PasswordResetRepository>): PasswordResetRepository {
  return {
    create: mock(() => Promise.resolve({} as any)),
    findByToken: mock(() => Promise.resolve(null)),
    markAsUsed: mock(() => Promise.resolve()),
    invalidateUnusedForUser: mock(() => Promise.resolve()),
    deleteExpired: mock(() => Promise.resolve()),
    ...overrides,
  };
}

export function createMockRoleRepository(overrides?: Partial<RoleRepository>): RoleRepository {
  return {
    findById: mock(() =>
      Promise.resolve({
        id: "role-123",
        name: "USER",
        priority: ROLE_PRIORITY_BY_NAME.USER,
      })
    ),
    findAll: mock(() =>
      Promise.resolve([
        {
          id: "role-123",
          name: "USER",
          description: "Standard user",
          priority: ROLE_PRIORITY_BY_NAME.USER,
        },
      ])
    ),
    ...overrides,
  };
}

export function createMockVerificationTokenRepository(
  overrides?: Partial<VerificationTokenRepository>
): VerificationTokenRepository {
  return {
    deleteUnusedByUserAndType: mock(() => Promise.resolve()),
    create: mock(() => Promise.resolve()),
    findValidToken: mock(() => Promise.resolve(null)),
    markVerified: mock(() => Promise.resolve()),
    ...overrides,
  };
}
