import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { AppError, UnauthorizedError } from "../../../../shared/errors";
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

// Helper to create test app with error handler
function createTestApp() {
  return new Elysia().onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { error: error.toClientJSON() };
    }
    set.status = 500;
    return { error: String(error) };
  });
}

describe("Auth Plugin", () => {
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
    passwordHistory: [],
    deactivatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    } as any;
    
    mockUserRepository = {
      findById: mock(async () => mockUser),
      findUserAuthStatus: mock(async () => ({
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        roleId: "role-123",
        roleName: "USER",
      })),
    } as any;
    
    mockAuthCacheService = {
      get: mock(async () => null),
      set: mock(async () => {}),
      invalidate: mock(async () => {}),
      isRecentlyValidated: mock(async () => false),
      markValidated: mock(async () => {}),
    } as any;
    
    mockSessionCacheService = {
      getById: mock(async () => null),
      set: mock(async () => {}),
      invalidate: mock(async () => {}),
      updateLastSeen: mock(async () => {}),
      isMarkedRevoked: mock(async () => false),
      isRecentlyValidated: mock(async () => false),
      markValidated: mock(async () => {}),
    } as any;
    
    mockRedis = {
      get: mock(async () => null),
      setex: mock(async () => {}),
    } as any;

    mockScopeService = createMockScopeService();

    mockAccessGrantService = {
      getActiveGrants: mock(async () => []),
    } as any;
  });

  describe("Auth context injection", () => {
    it("should inject auth helper functions into route context", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

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

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId, getSessionId, getUser }: any) => {
          const userId = await getUserId();
          const sessionId = await getSessionId();
          const user = await getUser();

          return {
            userId,
            sessionId,
            userEmail: user.email,
          };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.userId).toBe("user-123");
      expect(body.sessionId).toBe("session-123");
      expect(body.userEmail).toBe("user@example.com");
    });

    it("should throw UnauthorizedError when no auth header provided", async () => {
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

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test")
      );

      expect(response.status).toBe(401);
    });

    it("should throw UnauthorizedError for invalid token", async () => {
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

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer invalid-token",
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("should throw UnauthorizedError when session not found", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "non-existent-session",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const mockSessionRepoWithNoSession = {
        findById: mock(async () => null),
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithNoSession,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("should throw UnauthorizedError for revoked session", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const revokedSession = {
        ...mockSession,
        revokedAt: new Date(),
      };

      const mockSessionRepoWithRevokedSession = {
        findById: mock(async () => revokedSession),
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithRevokedSession,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("should throw UnauthorizedError for expired session", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      };

      const mockSessionRepoWithExpiredSession = {
        findById: mock(async () => expiredSession),
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithExpiredSession,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("should throw UnauthorizedError when cached session is stale but DB is revoked", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        user: {
          id: "user-123",
          email: "user@example.com",
          username: "testuser",
          status: UserStatus.ACTIVE,
          tokenVersion: 1,
          role: {
            id: "role-123",
            name: "USER",
          },
        },
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => false);
      mockSessionCacheService.isRecentlyValidated = mock(async () => false);

      const mockSessionRepoWithStaleCache = {
        findById: mock(async () => mockSession),
        findSessionStatus: mock(async () => ({
          userId: "user-123",
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })),
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithStaleCache,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
      expect(mockSessionRepoWithStaleCache.findSessionStatus).toHaveBeenCalledWith("session-123");
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith("session-123");
      expect(mockSessionRepoWithStaleCache.findById).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when cached session is stale but DB is expired", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        user: {
          id: "user-123",
          email: "user@example.com",
          username: "testuser",
          status: UserStatus.ACTIVE,
          tokenVersion: 1,
          role: {
            id: "role-123",
            name: "USER",
          },
        },
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => false);
      mockSessionCacheService.isRecentlyValidated = mock(async () => false);

      const mockSessionRepoWithStaleCache = {
        findById: mock(async () => mockSession),
        findSessionStatus: mock(async () => ({
          userId: "user-123",
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        })),
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithStaleCache,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
      expect(mockSessionRepoWithStaleCache.findSessionStatus).toHaveBeenCalledWith("session-123");
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith("session-123");
    });

    it("should reject cached session when revoked marker is present without DB lookup", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => true);

      const findSessionStatus = mock(async () => ({
        userId: "user-123",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }));

      const mockSessionRepoWithRevokedMarker = {
        findById: mock(async () => mockSession),
        findSessionStatus,
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithRevokedMarker,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
      expect(findSessionStatus).not.toHaveBeenCalled();
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith("session-123");
    });

    it("should skip session DB revalidation when recently validated", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => false);
      mockSessionCacheService.isRecentlyValidated = mock(async () => true);

      const findSessionStatus = mock(async () => ({
        userId: "user-123",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }));

      const mockSessionRepoRecentlyValidated = {
        findById: mock(async () => mockSession),
        findSessionStatus,
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoRecentlyValidated,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(findSessionStatus).not.toHaveBeenCalled();
    });

    it("should return 403 when auth cache has stale active status but DB user is suspended", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      mockAuthCacheService.get = mock(async () => ({
        userId: "user-123",
        roleId: "role-123",
        roleName: "USER",
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
      }));
      mockAuthCacheService.isRecentlyValidated = mock(async () => false);

      mockUserRepository.findUserAuthStatus = mock(async () => ({
        status: UserStatus.SUSPENDED,
        tokenVersion: 1,
        roleId: "role-123",
        roleName: "USER",
      }));

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

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("ACCOUNT_SUSPENDED");
      expect(mockUserRepository.findUserAuthStatus).toHaveBeenCalledWith("user-123");
      expect(mockAuthCacheService.set).toHaveBeenCalledWith("user-123", {
        userId: "user-123",
        roleId: "role-123",
        roleName: "USER",
        status: UserStatus.SUSPENDED,
        tokenVersion: 1,
      });
    });

    it("should throw UnauthorizedError for token version mismatch", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const updatedUser = {
        ...mockUser,
        tokenVersion: 2,
      };

      const mockUserRepoWithUpdatedVersion = {
        findById: mock(async () => updatedUser),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepository,
        userRepository: mockUserRepoWithUpdatedVersion,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 for suspended user", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const suspendedUser = {
        ...mockUser,
        status: UserStatus.SUSPENDED,
      };

      const sessionWithSuspendedUser = {
        ...mockSession,
        user: suspendedUser,
      };

      const mockSessionRepoWithSuspendedUser = {
        findById: mock(async () => sessionWithSuspendedUser),
        updateLastSeen: mock(async () => {}),
      } as any;

      const mockUserRepoWithSuspendedUser = {
        findById: mock(async () => suspendedUser),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithSuspendedUser,
        userRepository: mockUserRepoWithSuspendedUser,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("ACCOUNT_SUSPENDED");
    });

    it("should return 403 for inactive user", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const inactiveUser = {
        ...mockUser,
        status: UserStatus.INACTIVE,
      };

      const sessionWithInactiveUser = {
        ...mockSession,
        user: inactiveUser,
      };

      const mockSessionRepoWithInactiveUser = {
        findById: mock(async () => sessionWithInactiveUser),
        updateLastSeen: mock(async () => {}),
      } as any;

      const mockUserRepoWithInactiveUser = {
        findById: mock(async () => inactiveUser),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithInactiveUser,
        userRepository: mockUserRepoWithInactiveUser,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("ACCOUNT_DEACTIVATED");
    });

    it("should return 403 for pending user", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const pendingUser = {
        ...mockUser,
        status: UserStatus.PENDING,
      };

      const sessionWithPendingUser = {
        ...mockSession,
        user: pendingUser,
      };

      const mockSessionRepoWithPendingUser = {
        findById: mock(async () => sessionWithPendingUser),
        updateLastSeen: mock(async () => {}),
      } as any;

      const mockUserRepoWithPendingUser = {
        findById: mock(async () => pendingUser),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithPendingUser,
        userRepository: mockUserRepoWithPendingUser,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
        accessGrantService: mockAccessGrantService,
        redis: mockRedis,
      });

      const testApp = createTestApp()
        .use(auth)
        .get("/test", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const response = await testApp.handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("ACCOUNT_PENDING");
    });
  });

  describe("Scoped derive", () => {
    it("should only apply auth to routes that use the plugin", async () => {
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

      const testApp = createTestApp()
        .get("/public", () => ({ message: "public route" }))
        .use(auth)
        .get("/protected", async ({ getUserId }: any) => {
          const userId = await getUserId();
          return { userId };
        });

      const publicResponse = await testApp.handle(
        new Request("http://localhost/public")
      );

      expect(publicResponse.status).toBe(200);
      const publicBody = await publicResponse.json() as any;
      expect(publicBody.message).toBe("public route");

      const protectedResponse = await testApp.handle(
        new Request("http://localhost/protected")
      );

      expect(protectedResponse.status).toBe(401);
    });
  });
});
