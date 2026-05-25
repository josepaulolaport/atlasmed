import type { Role, User, Session, Invitation } from "@atlasmed/database";

// Re-export repository and cache mocks for convenience
export * from "./repository-mocks";
export * from "./cache-mocks";

export function createMockRole(overrides?: Partial<Role>): Role {
  return {
    id: "role-123",
    name: "USER",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$test",
    roleId: "role-123",
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    status: "ACTIVE",
    tokenVersion: 1,
    emailVerified: true,
    phoneVerified: false,
    lastLoginAt: null,
    passwordChangedAt: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deactivatedAt: null,
    ...overrides,
  };
}

export function createMockUserWithRole(overrides?: {
  user?: Partial<User>;
  role?: Partial<Role>;
}) {
  const role = createMockRole(overrides?.role);
  const user = createMockUser({ ...overrides?.user, roleId: role.id });

  return {
    ...user,
    role,
  };
}

export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-123",
    userId: "user-123",
    refreshTokenHash: "hashed-token-123",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    browserName: null,
    browserVersion: null,
    osName: null,
    deviceType: "UNKNOWN",
    sessionType: "WEB",
    revokedByUserId: null,
    replacedBySessionId: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

export function createMockInvitation(overrides?: Partial<Invitation>): Invitation {
  return {
    id: "invite-123",
    email: "newuser@example.com",
    phoneNumber: null,
    tokenHash: "hashed-token-123",
    roleId: "role-123",
    invitedByUserId: "admin-456",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

export function createMockInvitationWithRole(overrides?: {
  invitation?: Partial<Invitation>;
  role?: Partial<Role>;
}) {
  const role = createMockRole(overrides?.role);
  const invitation = createMockInvitation({
    ...overrides?.invitation,
    roleId: role.id,
  });

  return {
    ...invitation,
    role,
  };
}

export function createActiveSession() {
  return createMockSession({
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
  });
}

export function createExpiredSession() {
  return createMockSession({
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null,
  });
}

export function createRevokedSession() {
  return createMockSession({
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(),
    revokedReason: "User logout",
  });
}

export function createActiveUser() {
  return createMockUser({
    status: "ACTIVE",
  });
}

export function createInactiveUser() {
  return createMockUser({
    status: "INACTIVE",
    deactivatedAt: new Date(),
  });
}

export function createSuspendedUser() {
  return createMockUser({
    status: "SUSPENDED",
  });
}

export function createPendingInvitation() {
  return createMockInvitation({
    status: "PENDING",
    acceptedAt: null,
    revokedAt: null,
  });
}

export function createAcceptedInvitation() {
  return createMockInvitation({
    status: "ACCEPTED",
    acceptedAt: new Date(),
    revokedAt: null,
  });
}

export function createRevokedInvitation() {
  return createMockInvitation({
    status: "REVOKED",
    acceptedAt: null,
    revokedAt: new Date(),
  });
}

export function createExpiredInvitation() {
  return createMockInvitation({
    status: "PENDING",
    expiresAt: new Date(Date.now() - 1000),
    acceptedAt: null,
    revokedAt: null,
  });
}
