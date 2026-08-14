import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { AppError, UnauthorizedError } from "../../../../shared/errors";
import { TokenService } from "../../application/services/token.service";
import { createAuthPlugin } from "./auth.plugin";
import type { SessionRepository } from "../../application/interfaces/session.repository.interface";
import type { UserRepository } from "../../application/interfaces/user.repository.interface";
import type { AuthCacheService } from "../cache/auth-cache.service";
import type { SessionCacheService } from "../cache/session-cache.service";
import type { ScopeService } from "../../application/services/scope.service";
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
  let mockRedis: Redis;

  const mockUser = {
    id: 123,
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    passwordHash: "$argon2id$test",
    roleId: 1,
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    status: "ACTIVE",
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
      id: 1,
      name: "REP",
      description: null,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockSession = {
    id: 1,
    userId: 123,
    refreshTokenHash: "hashed-token",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    browserName: "Chrome",
    browserVersion: "120.0",
    osName: "macOS",
    deviceType: "DESKTOP",
    sessionType: "WEB",
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
        status: "ACTIVE",
        tokenVersion: 1,
        roleId: 1,
        roleName: "REP",
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
      clearRevoked: mock(async () => {}),
      isRecentlyValidated: mock(async () => false),
      markValidated: mock(async () => {}),
    } as any;
    
    mockRedis = {
      get: mock(async () => null),
      setex: mock(async () => {}),
    } as any;

    mockScopeService = createMockScopeService();
  });

  describe("Auth context injection", () => {
    it("should inject auth helper functions into route context", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
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
      expect(body.userId).toBe(123);
      expect(body.sessionId).toBe(1);
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
        sub: "123",
        sid: "non-existent-session",
        role: "REP",
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
        sub: "123",
        sid: "1",
        role: "REP",
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
        sub: "123",
        sid: "1",
        role: "REP",
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
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: 1,
        userId: 123,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        user: {
          id: 123,
          email: "user@example.com",
          username: "testuser",
          status: "ACTIVE",
          tokenVersion: 1,
          role: {
            id: 1,
            name: "REP",
          },
        },
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => false);
      mockSessionCacheService.isRecentlyValidated = mock(async () => false);

      const mockSessionRepoWithStaleCache = {
        findById: mock(async () => mockSession),
        findSessionStatus: mock(async () => ({
          userId: 123,
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
      expect(mockSessionRepoWithStaleCache.findSessionStatus).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith(1);
      expect(mockSessionRepoWithStaleCache.findById).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when cached session is stale but DB is expired", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: 1,
        userId: 123,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        user: {
          id: 123,
          email: "user@example.com",
          username: "testuser",
          status: "ACTIVE",
          tokenVersion: 1,
          role: {
            id: 1,
            name: "REP",
          },
        },
      };

      mockSessionCacheService.getById = mock(async () => cachedSession);
      mockSessionCacheService.isMarkedRevoked = mock(async () => false);
      mockSessionCacheService.isRecentlyValidated = mock(async () => false);

      const mockSessionRepoWithStaleCache = {
        findById: mock(async () => mockSession),
        findSessionStatus: mock(async () => ({
          userId: 123,
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
      expect(mockSessionRepoWithStaleCache.findSessionStatus).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith(1);
    });

    it("should reject cached session when revoked marker is confirmed by DB", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: 1,
        userId: 123,
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
        userId: 123,
        revokedAt: new Date(),
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
      expect(findSessionStatus).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.invalidate).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.clearRevoked).not.toHaveBeenCalled();
    });

    it("should self-heal and allow request when revoked marker is stale but DB confirms session is healthy", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: 1,
        userId: 123,
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
        userId: 123,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }));

      const mockSessionRepoWithStaleMarker = {
        findById: mock(async () => mockSession),
        findSessionStatus,
        updateLastSeen: mock(async () => {}),
      } as any;

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepoWithStaleMarker,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
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
      expect(findSessionStatus).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.clearRevoked).toHaveBeenCalledWith(1);
      expect(mockSessionCacheService.invalidate).not.toHaveBeenCalled();
    });

    it("should skip session DB revalidation when recently validated", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const cachedSession = {
        id: 1,
        userId: 123,
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
        userId: 123,
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
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      mockAuthCacheService.get = mock(async () => ({
        userId: 123,
        roleId: 1,
        roleName: "REP",
        status: "ACTIVE",
        tokenVersion: 1,
      }));
      mockAuthCacheService.isRecentlyValidated = mock(async () => false);

      mockUserRepository.findUserAuthStatus = mock(async () => ({
        status: "SUSPENDED",
        tokenVersion: 1,
        roleId: 1,
        roleName: "REP",
      }));

      const auth = createAuthPlugin({
        tokenService,
        sessionRepository: mockSessionRepository,
        userRepository: mockUserRepository,
        authCacheService: mockAuthCacheService,
        sessionCacheService: mockSessionCacheService,
        scopeService: mockScopeService,
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
      expect(mockUserRepository.findUserAuthStatus).toHaveBeenCalledWith(123);
      expect(mockAuthCacheService.set).toHaveBeenCalledWith(123, {
        userId: 123,
        roleId: 1,
        roleName: "REP",
        status: "SUSPENDED",
        tokenVersion: 1,
      });
    });

    it("should throw UnauthorizedError for token version mismatch", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "123",
        sid: "1",
        role: "REP",
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
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const suspendedUser = {
        ...mockUser,
        status: "SUSPENDED",
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
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const inactiveUser = {
        ...mockUser,
        status: "INACTIVE",
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
        sub: "123",
        sid: "1",
        role: "REP",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const pendingUser = {
        ...mockUser,
        status: "PENDING",
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

describe("last seen (spec 0015 §4.1)", () => {
  const tokenService = new TokenService();

  function harness(overrides: {
    lastSeenAt?: Date | null;
  } = {}) {
    const updateLastSeen = mock(async () => {});
    const user = {
      id: 123,
      email: "rep@atlasmed.com.br",
      username: null,
      status: "ACTIVE",
      tokenVersion: 1,
      role: { id: 3, name: "REP" },
    };
    const session = {
      id: 1,
      userId: 123,
      refreshTokenHash: "hash",
      ipAddress: null,
      userAgent: null,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      revokedAt: null,
      createdAt: new Date().toISOString(),
      lastSeenAt:
        overrides.lastSeenAt === undefined
          ? new Date().toISOString()
          : (overrides.lastSeenAt?.toISOString() ?? null),
      user,
    };

    const app = createTestApp().use(
      createAuthPlugin({
        tokenService,
        sessionRepository: { updateLastSeen } as never,
        userRepository: {
          findById: mock(async () => user),
          findUserAuthStatus: mock(async () => ({
            status: "ACTIVE",
            tokenVersion: 1,
            roleId: 3,
            roleName: "REP",
          })),
        } as never,
        authCacheService: {
          get: mock(async () => null),
          set: mock(async () => {}),
          invalidate: mock(async () => {}),
          isRecentlyValidated: mock(async () => true),
          markValidated: mock(async () => {}),
        } as never,
        sessionCacheService: {
          getById: mock(async () => session),
          set: mock(async () => {}),
          invalidate: mock(async () => {}),
          updateLastSeen: mock(async () => {}),
          isMarkedRevoked: mock(async () => false),
          clearRevoked: mock(async () => {}),
          isRecentlyValidated: mock(async () => true),
          markValidated: mock(async () => {}),
        } as never,
        scopeService: createMockScopeService(),
        redis: { get: mock(async () => null), setex: mock(async () => {}) } as never,
      }),
    ).get("/t", () => ({ ok: true }));

    return { app, updateLastSeen };
  }

  async function call(
    app: ReturnType<typeof harness>["app"],
    headers: Record<string, string> = {},
  ) {
    const token = await tokenService.signAccessToken({
      sub: "123",
      sid: "1",
      role: "REP",
      tokenVersion: 1,
      iat: Math.floor(Date.now() / 1000),
    });
    const response = await app.handle(
      new Request("http://localhost/t", {
        headers: { Authorization: `Bearer ${token}`, ...headers },
      }),
    );
    // The write is fire-and-forget, so let the microtask queue drain.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return response;
  }

  it("ignores traffic no person set in motion", async () => {
    // The session token refreshes on an eight-minute timer. Counting that kept
    // an untouched phone reporting its owner as active indefinitely.
    const { app, updateLastSeen } = harness({ lastSeenAt: new Date(0) });
    await call(app);

    expect(updateLastSeen).not.toHaveBeenCalled();
  });

  it("records a request a person set in motion", async () => {
    const { app, updateLastSeen } = harness({ lastSeenAt: new Date(0) });
    await call(app, { "X-Client-Activity": "1" });

    expect(updateLastSeen).toHaveBeenCalledWith(1);
  });

  it("writes at most once per window, without asking Redis", async () => {
    // Throttled against the session already in hand, so the common request
    // costs no round-trip at all — the previous implementation spent a Redis
    // GET on every authenticated request to learn the same thing.
    const { app, updateLastSeen } = harness({ lastSeenAt: new Date() });
    await call(app, { "X-Client-Activity": "1" });

    expect(updateLastSeen).not.toHaveBeenCalled();
  });

  it("records the first activity of a session that has none", async () => {
    const { app, updateLastSeen } = harness({ lastSeenAt: null });
    await call(app, { "X-Client-Activity": "1" });

    expect(updateLastSeen).toHaveBeenCalledWith(1);
  });
});
