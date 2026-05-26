import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

const mockLogSuspiciousActivity = mock(async () => {});
const mockRecordSuspiciousActivity = mock(() => {});

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService({
    logSuspiciousActivity: mockLogSuspiciousActivity,
  }),
}));

mock.module("../../../../infrastructure/monitoring/metrics.service", () => ({
  metricsService: createMockMetricsService({
    recordSuspiciousActivity: mockRecordSuspiciousActivity,
  }),
}));

import { RefreshSessionUseCase } from "./refresh-session.use-case";
import { TokenService } from "../services/token.service";
import { SessionService } from "../services/session.service";
import {
  TokenInvalidError,
  AccountSuspendedError,
  AccountDeactivatedError,
  AccountPendingError,
  RefreshTokenReuseDetectedError,
  SessionSecurityViolationError,
} from "../../../../shared/errors";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { createMockSessionRepository, createMockSessionCache } from "../../test-helpers/fixtures";
import { generateDeviceFingerprint } from "../../../../shared/utils/device-fingerprint";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

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
    id: "session-123",
    userId: "user-123",
    refreshTokenHash: "old-hashed-token",
    ipAddress: "192.168.1.1",
    userAgent: CHROME_UA,
    deviceFingerprint: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
    user: mockUser,
  };

  beforeEach(() => {
    mockLogSuspiciousActivity.mockClear();
    mockRecordSuspiciousActivity.mockClear();

    mockSessionRepository = createMockSessionRepository({
      findActiveByTokenHash: mock(async () => mockOldSession),
      findById: mock(async () => mockOldSession),
      rotateRefreshTokenTransaction: mock(async () => ({
        ...mockOldSession,
        refreshTokenHash: "new-hashed-token",
        lastSeenAt: new Date(),
      })),
    });

    mockSessionCache = createMockSessionCache({
      getByTokenHash: mock(async () => null),
      getSupersededSession: mock(async () => null),
      set: mock(async () => {}),
      updateAfterRefresh: mock(async () => {}),
      invalidate: mock(async () => {}),
    });

    refreshSessionUseCase = new RefreshSessionUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
      tokenService: new TokenService(),
      sessionService: new SessionService({
        sessionRepository: mockSessionRepository,
        sessionCache: mockSessionCache,
      }),
    });
  });

  describe("valid refresh flow", () => {
    it("should refresh session with valid token", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

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
    });

    it("should preserve session identity during refresh", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(mockSessionRepository.rotateRefreshTokenTransaction).toHaveBeenCalledTimes(1);
      const callArgs = (mockSessionRepository.rotateRefreshTokenTransaction as any)
        .mock.calls[0][0];
      expect(callArgs.sessionId).toBe("session-123");
    });

    it("should include ipAddress when provided", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
        ipAddress: "192.168.1.10",
        userAgent: CHROME_UA,
      });

      const callArgs = (mockSessionRepository.rotateRefreshTokenTransaction as any)
        .mock.calls[0][0];
      expect(callArgs.ipAddress).toBe("192.168.1.10");
    });

    it("should update session cache after refresh", async () => {
      await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
      });

      expect(mockSessionCache.updateAfterRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalid refresh token", () => {
    it("should throw TokenInvalidError when token not found", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);
      mockSessionCache.getSupersededSession = mock(async () => null);

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "invalid-token",
        })
      ).rejects.toThrow(TokenInvalidError);
    });

    it("should not rotate session when token invalid", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);
      mockSessionCache.getSupersededSession = mock(async () => null);

      try {
        await refreshSessionUseCase.execute({
          refreshToken: "invalid-token",
        });
      } catch {}

      expect(mockSessionRepository.rotateRefreshTokenTransaction).not.toHaveBeenCalled();
    });
  });

  describe("refresh token reuse detection", () => {
    it("should revoke all sessions when rotate detects hash mismatch (Path A)", async () => {
      mockSessionRepository.rotateRefreshTokenTransaction = mock(async () => {
        throw new RefreshTokenReuseDetectedError({
          userId: "user-123",
          sessionId: "session-123",
        });
      });

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
          ipAddress: "192.168.1.1",
          userAgent: CHROME_UA,
        })
      ).rejects.toThrow(RefreshTokenReuseDetectedError);

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
        "user-123",
        undefined
      );
      expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(
        "user-123",
        undefined
      );
      expect(mockLogSuspiciousActivity).toHaveBeenCalledWith({
        userId: "user-123",
        sessionId: "session-123",
        reason: "refresh_token_reuse",
        ipAddress: "192.168.1.1",
        userAgent: CHROME_UA,
      });
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith(
        "refresh_token_reuse"
      );
    });

    it("should revoke all sessions when superseded hash is replayed (Path B)", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => null);
      mockSessionCache.getByTokenHash = mock(async () => null);
      mockSessionCache.getSupersededSession = mock(async () => ({
        sessionId: "session-123",
        userId: "user-123",
      }));

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "superseded-refresh-token",
          ipAddress: "10.0.0.2",
          userAgent: "test-agent",
        })
      ).rejects.toThrow(RefreshTokenReuseDetectedError);

      expect(mockSessionRepository.rotateRefreshTokenTransaction).not.toHaveBeenCalled();
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
        "user-123",
        undefined
      );
      expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(
        "user-123",
        undefined
      );
      expect(mockLogSuspiciousActivity).toHaveBeenCalledWith({
        userId: "user-123",
        sessionId: "session-123",
        reason: "refresh_token_reuse",
        ipAddress: "10.0.0.2",
        userAgent: "test-agent",
      });
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith(
        "refresh_token_reuse"
      );
    });
  });

  describe("session security validation", () => {
    it("should revoke session and throw when user agent changes to a different browser", async () => {
      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
          ipAddress: "192.168.1.1",
          userAgent: FIREFOX_UA,
        })
      ).rejects.toThrow(SessionSecurityViolationError);

      expect(mockSessionRepository.revokeForSecurityViolation).toHaveBeenCalledWith(
        "session-123"
      );
      expect(mockSessionCache.invalidate).toHaveBeenCalledWith("session-123");
      expect(mockSessionRepository.rotateRefreshTokenTransaction).not.toHaveBeenCalled();
      expect(mockLogSuspiciousActivity).toHaveBeenCalled();
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith(
        "user_agent_mismatch"
      );
    });

    it("should allow refresh when request context matches stored session", async () => {
      const result = await refreshSessionUseCase.execute({
        refreshToken: "valid-refresh-token",
        ipAddress: "192.168.1.10",
        userAgent: CHROME_UA,
        acceptLanguage: "en-US",
      });

      expect(result).toHaveProperty("accessToken");
      expect(mockSessionRepository.rotateRefreshTokenTransaction).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revokeForSecurityViolation).not.toHaveBeenCalled();
    });

    it("should load device fingerprint from DB when session comes from cache", async () => {
      const storedFingerprint = generateDeviceFingerprint({
        userAgent: CHROME_UA,
        acceptLanguage: "en-US",
      });

      mockSessionCache.getByTokenHash = mock(async () => ({
        id: mockOldSession.id,
        userId: mockOldSession.userId,
        refreshTokenHash: mockOldSession.refreshTokenHash,
        expiresAt: mockOldSession.expiresAt.toISOString(),
        revokedAt: null,
        ipAddress: mockOldSession.ipAddress,
        userAgent: mockOldSession.userAgent,
        lastSeenAt: mockOldSession.lastSeenAt.toISOString(),
        createdAt: mockOldSession.createdAt.toISOString(),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          status: mockUser.status,
          tokenVersion: mockUser.tokenVersion,
          role: {
            id: mockUser.role.id,
            name: mockUser.role.name,
          },
        },
      }));

      mockSessionRepository.findById = mock(async () => ({
        ...mockOldSession,
        deviceFingerprint: storedFingerprint,
      }));

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
          ipAddress: "192.168.1.1",
          userAgent: CHROME_UA,
          acceptLanguage: "fr-FR",
        })
      ).rejects.toThrow(SessionSecurityViolationError);

      expect(mockSessionRepository.findById).toHaveBeenCalledWith("session-123");
      expect(mockSessionRepository.revokeForSecurityViolation).toHaveBeenCalledWith(
        "session-123"
      );
    });
  });

  describe("inactive user", () => {
    it("should throw AccountDeactivatedError when user is INACTIVE", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => ({
        ...mockOldSession,
        user: { ...mockUser, status: "INACTIVE" },
      }));

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow(AccountDeactivatedError);
    });

    it("should throw when user is SUSPENDED", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => ({
        ...mockOldSession,
        user: { ...mockUser, status: "SUSPENDED" },
      }));

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow(AccountSuspendedError);
    });

    it("should throw AccountPendingError when user is PENDING", async () => {
      mockSessionRepository.findActiveByTokenHash = mock(async () => ({
        ...mockOldSession,
        user: { ...mockUser, status: "PENDING" },
      }));

      await expect(
        refreshSessionUseCase.execute({
          refreshToken: "valid-refresh-token",
        })
      ).rejects.toThrow(AccountPendingError);

      expect(mockSessionRepository.rotateRefreshTokenTransaction).not.toHaveBeenCalled();
    });
  });
});
