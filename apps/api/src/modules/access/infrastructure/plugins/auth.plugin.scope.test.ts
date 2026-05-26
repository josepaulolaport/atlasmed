import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserStatus, AuthSessionDeviceType, AuthSessionType } from "@atlasmed/database";
import { TokenService } from "../../application/services/token.service";
import { createAuthPlugin } from "./auth.plugin";
import type { SessionRepository } from "../../application/interfaces/session.repository.interface";
import type { UserRepository } from "../../application/interfaces/user.repository.interface";
import type { AuthCacheService } from "../cache/auth-cache.service";
import type { SessionCacheService } from "../cache/session-cache.service";
import type { ScopeService } from "../../application/services/scope.service";
import type { AccessGrantService } from "../../application/services/access-grant.service";
import type { Redis } from "ioredis";
import { createMockScopeService } from "../../test-helpers/fixtures";
import { createAccessTestApp } from "../../test-helpers/access-test-app";

function createTestApp() {
  return createAccessTestApp();
}

describe("Auth Plugin Scope", () => {
  let tokenService: TokenService;
  let mockSessionRepository: SessionRepository;
  let mockUserRepository: UserRepository;
  let mockAuthCacheService: AuthCacheService;
  let mockSessionCacheService: SessionCacheService;
  let mockScopeService: ScopeService;
  let mockAccessGrantService: AccessGrantService;
  let mockRedis: Redis;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    passwordHash: "$argon2id$test",
    roleId: "role-123",
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    tokenVersion: 1,
    emailVerified: true,
    phoneVerified: false,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    lastLoginAt: new Date(),
    passwordChangedAt: null,
    passwordExpiresAt: null,
    passwordHistory: [],
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deactivatedAt: null,
    role: {
      id: "role-123",
      name: "USER",
      description: null,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockSession = {
    id: "session-123",
    userId: "user-123",
    refreshTokenHash: "hashed-token",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    browserName: "Chrome",
    browserVersion: "120.0",
    osName: "macOS",
    deviceType: AuthSessionDeviceType.DESKTOP,
    sessionType: AuthSessionType.WEB,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
    revokedByUserId: null,
    replacedBySessionId: null,
    user: mockUser,
  };

  beforeEach(() => {
    tokenService = new TokenService();

    mockSessionRepository = {
      findById: mock(async () => mockSession),
      updateLastSeen: mock(async () => {}),
    } as SessionRepository;

    mockUserRepository = {
      findById: mock(async () => mockUser),
      findUserAuthStatus: mock(async () => ({
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        roleId: "role-123",
        roleName: "USER",
      })),
    } as UserRepository;

    mockAuthCacheService = {
      get: mock(async () => null),
      set: mock(async () => {}),
      invalidate: mock(async () => {}),
      isRecentlyValidated: mock(async () => false),
      markValidated: mock(async () => {}),
    } as AuthCacheService;

    mockSessionCacheService = {
      getById: mock(async () => null),
      set: mock(async () => {}),
      invalidate: mock(async () => {}),
      updateLastSeen: mock(async () => {}),
      isMarkedRevoked: mock(async () => false),
      isRecentlyValidated: mock(async () => false),
      markValidated: mock(async () => {}),
    } as SessionCacheService;

    mockRedis = {
      get: mock(async () => null),
      setex: mock(async () => {}),
    } as Redis;

    mockScopeService = createMockScopeService();

    mockAccessGrantService = {
      getActiveGrants: mock(async () => []),
    } as AccessGrantService;
  });

  async function signToken(role = "USER") {
    return tokenService.signAccessToken({
      sub: "user-123",
      sid: "session-123",
      role,
      tokenVersion: 1,
      iat: Math.floor(Date.now() / 1000),
    });
  }

  function buildAuthApp() {
    const auth = createAuthPlugin({
      tokenService,
      sessionRepository: mockSessionRepository,
      userRepository: mockUserRepository,
      authCacheService: mockAuthCacheService,
      sessionCacheService: mockSessionCacheService,
      scopeService: mockScopeService,
      accessGrantService: mockAccessGrantService,
      redis: mockRedis,
    });

    return createTestApp().use(auth).get("/scope", async ({ getScope }: any) => {
      const scope = await getScope();
      return scope;
    });
  }

  it("calls scopeService.resolve with user id and role from token", async () => {
    const accessToken = await signToken("USER");
    const app = buildAuthApp();

    await app.handle(
      new Request("http://localhost/scope", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    expect(mockScopeService.resolve).toHaveBeenCalledWith("user-123", "USER");
  });

  it("returns isOperationallyActive false for USER without territories", async () => {
    mockScopeService.resolve = mock(() =>
      Promise.resolve({
        isGlobal: false,
        territoryIds: [],
        clinicIds: [],
        managedUserIds: [],
        isOperationallyActive: false,
      })
    );

    const accessToken = await signToken("USER");
    const app = buildAuthApp();
    const response = await app.handle(
      new Request("http://localhost/scope", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    const body = (await response.json()) as { isOperationallyActive: boolean };
    expect(body.isOperationallyActive).toBe(false);
    expect(body.territoryIds).toEqual([]);
  });

  it("returns isOperationallyActive true for USER with territories", async () => {
    mockScopeService.resolve = mock(() =>
      Promise.resolve({
        isGlobal: false,
        territoryIds: ["territory-a"],
        clinicIds: ["clinic-for-territory-a"],
        managedUserIds: [],
        isOperationallyActive: true,
      })
    );

    const accessToken = await signToken("USER");
    const app = buildAuthApp();
    const response = await app.handle(
      new Request("http://localhost/scope", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    const body = (await response.json()) as {
      isOperationallyActive: boolean;
      territoryIds: string[];
    };
    expect(body.isOperationallyActive).toBe(true);
    expect(body.territoryIds).toEqual(["territory-a"]);
  });

  it("returns managedUserIds for MANAGER scope", async () => {
    mockUserRepository.findById = mock(async () => ({
      ...mockUser,
      role: {
        ...mockUser.role,
        id: "role-manager",
        name: "MANAGER",
      },
    }));

    mockScopeService.resolve = mock(() =>
      Promise.resolve({
        isGlobal: false,
        territoryIds: ["territory-a"],
        clinicIds: [],
        managedUserIds: ["field-user-1", "field-user-2"],
        isOperationallyActive: true,
      })
    );

    const accessToken = await signToken("MANAGER");
    const app = buildAuthApp();
    const response = await app.handle(
      new Request("http://localhost/scope", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    expect(mockScopeService.resolve).toHaveBeenCalledWith("user-123", "MANAGER");
    const body = (await response.json()) as { managedUserIds: string[] };
    expect(body.managedUserIds).toEqual(["field-user-1", "field-user-2"]);
  });
});
