import { beforeEach, describe, expect, it, mock } from "bun:test";

import { hashToken } from "../../../../shared/utils/hash-token";

import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import {
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../shared/errors";

import { PasswordResetService } from "./password-reset.service";

describe("PasswordResetService", () => {
  let service: PasswordResetService;
  let mockRepository: PasswordResetRepository;

  beforeEach(() => {
    mockRepository = {
      create: mock(() => Promise.resolve({})),
      findByToken: mock(() => Promise.resolve(null)),
      markAsUsed: mock(() => Promise.resolve()),
      invalidateUnusedForUser: mock(() => Promise.resolve()),
      deleteExpired: mock(() => Promise.resolve()),
    };

    service = new PasswordResetService({ passwordResetRepository: mockRepository });
  });

  describe("createPasswordReset", () => {
    it("should invalidate prior unused tokens before creating a new one", async () => {
      const userId = "user-123";
      const mockPasswordReset = {
        id: "reset-123",
        userId,
        tokenHash: "hash-123",
        expiresAt: new Date(),
        usedAt: null,
      };

      mockRepository.create = mock(() => Promise.resolve(mockPasswordReset));

      await service.createPasswordReset({ userId });

      expect(mockRepository.invalidateUnusedForUser).toHaveBeenCalledWith(userId);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it("should create a password reset with token", async () => {
      const userId = "user-123";
      const mockPasswordReset = {
        id: "reset-123",
        userId,
        tokenHash: "hash-123",
        expiresAt: new Date(),
        usedAt: null,
      };

      mockRepository.create = mock(() => Promise.resolve(mockPasswordReset));

      const result = await service.createPasswordReset({ userId });

      expect(result.passwordReset).toEqual(mockPasswordReset);
      expect(result.token).toBeTruthy();
      expect(typeof result.token).toBe("string");
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it("should set expiration to 1 hour from now", async () => {
      const userId = "user-123";
      const beforeCreate = Date.now();

      await service.createPasswordReset({ userId });

      const createCall = (mockRepository.create as any).mock.calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();
      const expectedExpiry = beforeCreate + 1000 * 60 * 60;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe("validatePasswordResetToken", () => {
    it("should validate a valid token", async () => {
      const token = "valid-token";
      const tokenHash = hashToken(token);

      const mockPasswordReset = {
        id: "reset-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: null,
      };

      mockRepository.findByToken = mock(() => Promise.resolve(mockPasswordReset));

      const result = await service.validatePasswordResetToken(token);

      expect(result).toEqual(mockPasswordReset);
      expect(mockRepository.findByToken).toHaveBeenCalledWith({ tokenHash });
    });

    it("should throw ResetTokenInvalidError if token not found", async () => {
      mockRepository.findByToken = mock(() => Promise.resolve(null));

      await expect(service.validatePasswordResetToken("invalid-token")).rejects.toThrow(
        ResetTokenInvalidError
      );
    });

    it("should throw ResetTokenUsedError if token already used", async () => {
      const token = "used-token";
      const tokenHash = hashToken(token);

      const mockPasswordReset = {
        id: "reset-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: new Date(),
      };

      mockRepository.findByToken = mock(() => Promise.resolve(mockPasswordReset));

      await expect(service.validatePasswordResetToken(token)).rejects.toThrow(
        ResetTokenUsedError
      );
    });

    it("should throw ResetTokenExpiredError if token expired", async () => {
      const token = "expired-token";
      const tokenHash = hashToken(token);

      const mockPasswordReset = {
        id: "reset-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      };

      mockRepository.findByToken = mock(() => Promise.resolve(mockPasswordReset));

      await expect(service.validatePasswordResetToken(token)).rejects.toThrow(
        ResetTokenExpiredError
      );
    });
  });
});
