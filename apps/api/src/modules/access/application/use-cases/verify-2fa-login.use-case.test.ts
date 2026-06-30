import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Verify2FALoginUseCase } from "./verify-2fa-login.use-case";
import { TokenService } from "../services/token.service";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { TwoFactorService } from "../services/two-factor.service";
import type { Pending2FALoginService } from "../services/pending-2fa-login.service";
import type { SessionService } from "../services/session.service";
import {
  createMockUserRepository,
  createMockSessionCache,
} from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  TokenInvalidError,
} from "../../../../shared/errors";

describe("Verify2FALoginUseCase", () => {
  let useCase: Verify2FALoginUseCase;
  let mockUserRepository: UserRepository;
  let mockSessionCache: ISessionCache;
  let mockPending2faLoginService: Pending2FALoginService;
  let mockTwoFactorService: TwoFactorService;
  let mockSessionService: SessionService;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    status: "ACTIVE",
    tokenVersion: 1,
    twoFactorEnabled: true,
    twoFactorSecret: "encrypted-secret",
    role: {
      id: "role-123",
      name: "USER",
    },
  };

  const mockSession = {
    id: "session-123",
    userId: "user-123",
    refreshToken: "refresh-token",
    refreshTokenHash: "refresh-hash",
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    lastSeenAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockAuditLog = createMockAuditLogService();
    mockMetrics = createMockMetricsService();
    mockUserRepository = createMockUserRepository({
      findById: mock(async () => mockUser),
      updateLastLogin: mock(async () => {}),
    });
    mockSessionCache = createMockSessionCache();
    mockPending2faLoginService = {
      get: mock(async () => ({
        userId: "user-123",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      })),
      consume: mock(async () => ({
        userId: "user-123",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      })),
      recordFailedAttempt: mock(async () => true),
      acquireVerificationLock: mock(async () => true),
    } as unknown as Pending2FALoginService;
    mockTwoFactorService = {
      decryptSecret: mock(() => "plain-secret"),
      verifyTotp: mock(async () => true),
    } as unknown as TwoFactorService;
    mockSessionService = {
      create: mock(async () => mockSession),
    } as unknown as SessionService;

    useCase = new Verify2FALoginUseCase({
      userRepository: mockUserRepository,
      sessionCache: mockSessionCache,
      twoFactorService: mockTwoFactorService,
      pending2faLoginService: mockPending2faLoginService,
      tokenService: new TokenService(),
      sessionService: mockSessionService,
      auditLog: mockAuditLog,
      metrics: mockMetrics,
    });
  });

  it("should complete login with valid pending token and TOTP code", async () => {
    const result = await useCase.execute({
      pendingToken: "pending-token",
      code: "123456",
    });

    expect(result.accessToken).toBeString();
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user.id).toBe("user-123");
    expect(mockSessionService.create).toHaveBeenCalledTimes(1);
    expect(mockSessionCache.set).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.logUserLogin).toHaveBeenCalledTimes(1);
    expect(mockMetrics.recordLoginAttempt).toHaveBeenCalledWith(true);
  });

  it("should reject invalid pending token", async () => {
    mockPending2faLoginService.get = mock(async () => {
      throw new TokenInvalidError();
    });

    await expect(
      useCase.execute({
        pendingToken: "expired-token",
        code: "123456",
      })
    ).rejects.toThrow(TokenInvalidError);
  });

  it("should reject invalid TOTP code", async () => {
    mockTwoFactorService.verifyTotp = mock(async () => false);

    await expect(
      useCase.execute({
        pendingToken: "pending-token",
        code: "000000",
      })
    ).rejects.toThrow(InvalidCredentialsError);

    expect(mockMetrics.recordLoginAttempt).toHaveBeenCalledWith(false, "invalid_2fa_code");
    expect(mockAuditLog.logFailedLoginAttempt).toHaveBeenCalledTimes(1);
  });

  it("should reject when 2FA is not enabled on account", async () => {
    mockUserRepository.findById = mock(async () => ({
      ...mockUser,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    }));

    await expect(
      useCase.execute({
        pendingToken: "pending-token",
        code: "123456",
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
