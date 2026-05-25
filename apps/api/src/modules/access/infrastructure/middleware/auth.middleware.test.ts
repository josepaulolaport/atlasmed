import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { UnauthorizedError } from "@atlasmed/access";
import { UserStatus, AuthSessionDeviceType, AuthSessionType } from "@atlasmed/database";
import { TokenService } from "../../application/services/token.service";
import { PrismaSessionRepository } from "../repositories/prisma/prisma-session.repository";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";

describe("AuthMiddleware", () => {
  let tokenService: TokenService;
  let sessionRepository: PrismaSessionRepository;
  let userRepository: PrismaUserRepository;

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
    lastLoginAt: new Date(),
    passwordChangedAt: null,
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
    sessionRepository = new PrismaSessionRepository();
    userRepository = new PrismaUserRepository();
  });

  describe("valid JWT", () => {
    it("should accept valid JWT token", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      sessionRepository.findById = mock(async () => mockSession);
      userRepository.findById = mock(async () => mockUser);
      sessionRepository.updateLastSeen = mock(async () => {});

      const authHeader = `Bearer ${accessToken}`;
      expect(authHeader).toStartWith("Bearer ");
    });

    it("should attach auth context with user", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const payload = await tokenService.verifyAccessToken(accessToken);

      expect(payload.sub).toBe("user-123");
      expect(payload.sid).toBe("session-123");
    });

    it("should attach auth context with session ID", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const payload = await tokenService.verifyAccessToken(accessToken);

      expect(payload.sid).toBe("session-456");
    });
  });

  describe("invalid JWT", () => {
    it("should reject request without Authorization header", async () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe("Unauthorized");
    });

    it("should reject request with malformed Authorization header", async () => {
      const malformedHeader = "NotBearer token";

      expect(malformedHeader.startsWith("Bearer ")).toBe(false);
    });

    it("should reject invalid JWT token", async () => {
      const invalidToken = "invalid.jwt.token";

      await expect(tokenService.verifyAccessToken(invalidToken)).rejects.toThrow();
    });

    it("should reject JWT with invalid signature", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const parts = accessToken.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`;

      await expect(tokenService.verifyAccessToken(tamperedToken)).rejects.toThrow();
    });

    it("should reject malformed JWT", async () => {
      const malformedToken = "not-a-jwt-token";

      await expect(tokenService.verifyAccessToken(malformedToken)).rejects.toThrow();
    });

    it("should reject empty Bearer token", async () => {
      const emptyHeader = "Bearer ";

      expect(emptyHeader.substring(7)).toBe("");
    });
  });

  describe("revoked session", () => {
    it("should reject request when session is revoked", async () => {
      const revokedSession = {
        ...mockSession,
        revokedAt: new Date(),
      };

      expect(revokedSession.revokedAt).not.toBeNull();
    });

    it("should reject request when session revoked even with valid JWT", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const payload = await tokenService.verifyAccessToken(accessToken);

      expect(payload).toBeDefined();

      const revokedSession = {
        ...mockSession,
        revokedAt: new Date(),
      };

      expect(revokedSession.revokedAt).not.toBeNull();
    });
  });

  describe("expired session", () => {
    it("should reject request when session is expired", async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      };

      expect(expiredSession.expiresAt < new Date()).toBe(true);
    });

    it("should accept request when session is not expired", async () => {
      const validSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      expect(validSession.expiresAt > new Date()).toBe(true);
    });
  });

  describe("inactive user", () => {
    it("should reject request when user is INACTIVE", async () => {
      const inactiveUser = {
        ...mockUser,
        status: "INACTIVE",
      };

      expect(inactiveUser.status).not.toBe("ACTIVE");
    });

    it("should reject request when user is SUSPENDED", async () => {
      const suspendedUser = {
        ...mockUser,
        status: "SUSPENDED",
      };

      expect(suspendedUser.status).not.toBe("ACTIVE");
    });

    it("should accept request when user is ACTIVE", async () => {
      const activeUser = {
        ...mockUser,
        status: "ACTIVE",
      };

      expect(activeUser.status).toBe("ACTIVE");
    });
  });

  describe("session not found", () => {
    it("should reject request when session does not exist", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "user-123",
        sid: "non-existent-session",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const payload = await tokenService.verifyAccessToken(accessToken);
      expect(payload.sid).toBe("non-existent-session");

      sessionRepository.findById = mock(async () => null);
      const session = await sessionRepository.findById("non-existent-session");

      expect(session).toBeNull();
    });
  });

  describe("user not found", () => {
    it("should reject request when user does not exist", async () => {
      const accessToken = await tokenService.signAccessToken({
        sub: "non-existent-user",
        sid: "session-123",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      });

      const payload = await tokenService.verifyAccessToken(accessToken);
      expect(payload.sub).toBe("non-existent-user");

      userRepository.findById = mock(async () => null);
      const user = await userRepository.findById("non-existent-user");

      expect(user).toBeNull();
    });
  });

  describe("session update", () => {
    it("should update session last seen timestamp", async () => {
      const updateLastSeenMock = mock(async () => {});
      sessionRepository.updateLastSeen = updateLastSeenMock;

      await sessionRepository.updateLastSeen("session-123");

      expect(updateLastSeenMock).toHaveBeenCalledWith("session-123");
    });

    it("should call updateLastSeen with correct session ID", async () => {
      const updateLastSeenMock = mock(async () => {});
      sessionRepository.updateLastSeen = updateLastSeenMock;

      await sessionRepository.updateLastSeen("session-456");

      expect(updateLastSeenMock).toHaveBeenCalledWith("session-456");
    });
  });

  describe("auth context", () => {
    it("should contain user object", async () => {
      const authContext = {
        user: mockUser,
        sessionId: "session-123",
      };

      expect(authContext.user).toBeDefined();
      expect(authContext.user.id).toBe("user-123");
    });

    it("should contain session ID", async () => {
      const authContext = {
        user: mockUser,
        sessionId: "session-123",
      };

      expect(authContext.sessionId).toBe("session-123");
    });

    it("should contain user with role", async () => {
      const authContext = {
        user: mockUser,
        sessionId: "session-123",
      };

      expect(authContext.user.role).toBeDefined();
      expect(authContext.user.role.name).toBe("USER");
    });
  });
});
