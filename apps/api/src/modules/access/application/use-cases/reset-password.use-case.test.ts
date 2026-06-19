import { beforeEach, describe, expect, it, mock } from "bun:test";
import { hash } from "argon2";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

import type { UserRepository } from "../interfaces/user.repository.interface";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockUserRepository,
  createMockAuthCache,
  createMockSessionCache,
  createMockPasswordResetRepository,
} from "../../test-helpers/fixtures";
import {
  PasswordReuseError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../shared/errors";
import { hashToken } from "../../../../shared/utils/hash-token";

import { ResetPasswordUseCase } from "./reset-password.use-case";
import { PasswordService } from "../services/password.service";
import { NotificationService } from "../services/notification.service";

describe("ResetPasswordUseCase", () => {
  let useCase: ResetPasswordUseCase;
  let mockUserRepository: UserRepository;
  let mockPasswordResetRepository: PasswordResetRepository;
  let mockAuthCache: IAuthCache;
  let mockSessionCache: ISessionCache;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  let currentPasswordHash: string;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    get passwordHash() {
      return currentPasswordHash;
    },
    passwordHistory: [] as string[],
    role: {
      id: "role-123",
      name: "USER",
    },
  };

  const mockPasswordReset = {
    id: "reset-123",
    userId: "user-123",
    tokenHash: hashToken("valid-token"),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    usedAt: null,
    get user() {
      return mockUser;
    },
  };

  beforeEach(async () => {
    currentPasswordHash = await hash("ExistingPassword1!");
    mockAuditLog = createMockAuditLogService();
    mockUserRepository = createMockUserRepository({
      resetPasswordTransaction: mock(() => Promise.resolve({
        user: mockUser,
        passwordReset: mockPasswordReset,
      })),
    });

    mockPasswordResetRepository = createMockPasswordResetRepository({
      findByToken: mock(() => Promise.resolve(mockPasswordReset)),
    });

    mockAuthCache = createMockAuthCache({
      invalidate: mock(() => Promise.resolve()),
    });

    mockSessionCache = createMockSessionCache({
      invalidateByUserId: mock(() => Promise.resolve()),
    });

    useCase = new ResetPasswordUseCase({
      userRepository: mockUserRepository,
      passwordResetRepository: mockPasswordResetRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
      passwordService: new PasswordService(),
      notificationService: new NotificationService(),
      auditLog: mockAuditLog,
      metrics: createMockMetricsService(),
    });
  });

  describe("execute", () => {
    it("should reset password with valid token", async () => {
      const result = await useCase.execute({
        token: "valid-token",
        newPassword: "newPassword123!",
        ipAddress: "192.168.1.1",
      });

      expect(result.success).toBe(true);
      expect(mockUserRepository.resetPasswordTransaction).toHaveBeenCalledTimes(1);
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
      expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith("user-123");
      expect(mockAuditLog.logPasswordChange).toHaveBeenCalledWith({
        userId: "user-123",
        method: "reset",
        ipAddress: "192.168.1.1",
      });
    });

    it("should throw ResetTokenInvalidError if token is not found", async () => {
      mockPasswordResetRepository.findByToken = mock(() => Promise.resolve(null));

      await expect(
        useCase.execute({
          token: "invalid-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow(ResetTokenInvalidError);

      expect(mockUserRepository.resetPasswordTransaction).not.toHaveBeenCalled();
    });

    it("should throw ResetTokenUsedError if token is already used", async () => {
      mockPasswordResetRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockPasswordReset,
          usedAt: new Date(),
        })
      );

      await expect(
        useCase.execute({
          token: "used-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow(ResetTokenUsedError);

      expect(mockUserRepository.resetPasswordTransaction).not.toHaveBeenCalled();
    });

    it("should throw ResetTokenExpiredError if token is expired", async () => {
      mockPasswordResetRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockPasswordReset,
          expiresAt: new Date(Date.now() - 1000),
        })
      );

      await expect(
        useCase.execute({
          token: "expired-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow(ResetTokenExpiredError);

      expect(mockUserRepository.resetPasswordTransaction).not.toHaveBeenCalled();
    });

    it("should reject reused password matching current hash", async () => {
      const realHash = await hash("SamePassword1!");
      mockPasswordResetRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockPasswordReset,
          user: {
            ...mockUser,
            passwordHash: realHash,
            passwordHistory: [],
          },
        })
      );

      await expect(
        useCase.execute({
          token: "valid-token",
          newPassword: "SamePassword1!",
        })
      ).rejects.toThrow(PasswordReuseError);

      expect(mockUserRepository.resetPasswordTransaction).not.toHaveBeenCalled();
    });

    it("should reject reused password matching password history", async () => {
      const historicPassword = "OldPassword1!";
      const historicHash = await hash(historicPassword);
      const currentHash = await hash("CurrentPassword1!");

      mockPasswordResetRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockPasswordReset,
          user: {
            ...mockUser,
            passwordHash: currentHash,
            passwordHistory: [historicHash],
          },
        })
      );

      await expect(
        useCase.execute({
          token: "valid-token",
          newPassword: historicPassword,
        })
      ).rejects.toThrow(PasswordReuseError);

      expect(mockUserRepository.resetPasswordTransaction).not.toHaveBeenCalled();
    });
  });
});
