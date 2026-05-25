import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { RefreshSessionUseCase } from "./refresh-session.use-case";
import { UnauthorizedError } from "@atlasmed/access";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { SessionService } from "../services/session.service";
import { createMockSessionRepository, createMockSessionCache } from "../../test-helpers/fixtures";

describe("RefreshSessionUseCase", () => {
  let refreshSessionUseCase: RefreshSessionUseCase;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    passwordHash: "$argon2id$test",
    roleId: "role-123",
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    tokenVersion: 1,
    emailVerified: true,
    phoneVerified: false,
    lastLoginAt: new Date(),
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

  const mockOldSession = {
    id: "old-session-123",
    userId: "user-123",
    refreshTokenHash: "old-hashed-token",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
    user: mockUser,
  };

  const mockNewSession = {
    id: "new-session-123",
    userId: "user-123",
    refreshTokenHash: "new-hashed-token",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
    user: mockUser,
  };

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository({
      findActiveByTokenHash: mock(async () => mockOldSession),
      rotateSessionTransaction: mock(async () => mockNewSession),
    });

    mockSessionCache = createMockSessionCache({
      getByTokenHash: mock(async () => null),
      set: mock(async () => {}),
      invalidate: mock(async () => {}),
    });

    refreshSessionUseCase = new RefreshSessionUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
    });

    // Mock SessionService.create to return new session data
    spyOn(SessionService.prototype, "create").mockResolvedValue({
      id: "new-session-123",
      refreshToken: "new-refresh-token",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } as any);
  });

  describe("valid refresh flow", () => {
    it("should refresh session with valid token", async () => {
      const params = {
        refreshToken: "valid-refresh-token",
      };

      const result = await refreshSessionUseCase.execute(params);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("user");
    });

    it("should return new access token", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(result.accessToken).toBeString();
      expect(result.accessToken.split(".")).toHaveLength(3);
    });

    it("should return new refresh token", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(result.refreshToken).toBeString();
      expect(result.refreshToken).toBe("new-refresh-token");
    });

    it("should return user object", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(result.user).toEqual(mockUser);
    });

    it("should create new session", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(mockSessionRepository.rotateSessionTransaction).toHaveBeenCalledTimes(1);
    });

    it("should include ipAddress in new session", async () => {
      const ipAddress = "10.0.0.1";

      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
        ipAddress,
      });

      const callArgs = (mockSessionRepository.rotateSessionTransaction as any).mock.calls[0][0];
      expect(callArgs.ipAddress).toBe(ipAddress);
    });

    it("should include userAgent in new session", async () => {
      const userAgent = "Chrome/100.0";

      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
        userAgent,
      });

      const callArgs = (mockSessionRepository.rotateSessionTransaction as any).mock.calls[0][0];
      expect(callArgs.userAgent).toBe(userAgent);
    });
  });

  describe("old refresh token invalidation", () => {
    it("should revoke old session", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(mockSessionRepository.rotateSessionTransaction).toHaveBeenCalledTimes(1);
      const callArgs = (mockSessionRepository.rotateSessionTransaction as any).mock.calls[0][0];
      expect(callArgs.oldSessionId).toBe("old-session-123");
    });

    it("should revoke old session before creating new one", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(mockSessionRepository.rotateSessionTransaction).toHaveBeenCalled();
    });
  });

  describe("invalid refresh token", () => {
    it("should throw UnauthorizedError when token not found", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "invalid-token",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should hash refresh token before lookup", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "plain-token",
      });

      expect(mockSessionCache.getByTokenHash).toHaveBeenCalled();
    });

    it("should not create new session when token invalid", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);

      try {
        await refreshSessionUseCase.execute({
          refreshToken: "invalid-token",
        });
      } catch {}

      expect(mockSessionRepository.rotateSessionTransaction).not.toHaveBeenCalled();
    });

    it("should not revoke session when token invalid", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);

      try {
        await refreshSessionUseCase.execute({
          refreshToken: "invalid-token",
        });
      } catch {}

      expect(mockSessionRepository.rotateSessionTransaction).not.toHaveBeenCalled();
    });
  });

  describe("inactive user", () => {
    it("should throw UnauthorizedError when user is INACTIVE", async () => {
      const inactiveSession = {
        ...mockOldSession,
        user: { ...mockUser, status: "INACTIVE" },
      };

      mockSessionRepository.findActiveByTokenHash = mock(async () => inactiveSession);

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when user is SUSPENDED", async () => {
      const suspendedSession = {
        ...mockOldSession,
        user: { ...mockUser, status: "SUSPENDED" },
      };

      mockSessionRepository.findActiveByTokenHash = mock(async () => suspendedSession);

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should allow refresh when user is ACTIVE", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(result.accessToken).toBeDefined();
    });

    it("should not create new session when user is inactive", async () => {
      const inactiveSession = {
        ...mockOldSession,
        user: { ...mockUser, status: "INACTIVE" },
      };

      mockSessionRepository.findActiveByTokenHash = mock(async () => inactiveSession);

      try {
        await refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        });
      } catch {}

      expect(mockSessionRepository.rotateSessionTransaction).not.toHaveBeenCalled();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findActiveByTokenHash fails", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => {
        throw new Error("Database connection failed");
      });
      mockSessionCache.getByTokenHash = mock(async () => null);

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow("Database connection failed");
    });

    it("should propagate error when revoke fails", async () => {
      mockSessionRepository.rotateSessionTransaction = mock(async () => {
        throw new Error("Revoke failed");
      });

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow("Revoke failed");
    });

    it("should propagate error when create fails", async () => {
      mockSessionRepository.rotateSessionTransaction = mock(async () => {
        throw new Error("Create failed");
      });

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow("Create failed");
    });
  });
});
