import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import { createMockUserRepository, createMockAuthCache } from "../../test-helpers/fixtures";

import { ResetPasswordUseCase } from "./reset-password.use-case";

describe("ResetPasswordUseCase", () => {
  let useCase: ResetPasswordUseCase;
  let mockUserRepository: UserRepository;
  let mockAuthCache: IAuthCache;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    passwordHash: "$argon2id$test",
    role: {
      id: "role-123",
      name: "USER",
    },
  };

  const mockPasswordReset = {
    id: "reset-123",
    userId: "user-123",
    tokenHash: "hash-123",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    usedAt: null,
  };

  beforeEach(() => {
    mockUserRepository = createMockUserRepository({
      resetPasswordTransaction: mock(() => Promise.resolve({
        user: mockUser,
        passwordReset: mockPasswordReset,
      })),
    });

    mockAuthCache = createMockAuthCache({
      invalidate: mock(() => Promise.resolve()),
    });

    useCase = new ResetPasswordUseCase({
      userRepository: mockUserRepository,
      authCache: mockAuthCache,
    });
  });

  describe("execute", () => {
    it("should reset password with valid token", async () => {
      const result = await useCase.execute({
        token: "valid-token",
        newPassword: "newPassword123!",
      });

      expect(result.success).toBe(true);
      expect(mockUserRepository.resetPasswordTransaction).toHaveBeenCalledTimes(1);
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should throw error if token is invalid", async () => {
      mockUserRepository.resetPasswordTransaction = mock(() => {
        throw new Error("Invalid or expired password reset token");
      });

      await expect(
        useCase.execute({
          token: "invalid-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow("Invalid or expired password reset token");
    });

    it("should throw error if token is already used", async () => {
      mockUserRepository.resetPasswordTransaction = mock(() => {
        throw new Error("Invalid or expired password reset token");
      });

      await expect(
        useCase.execute({
          token: "used-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow("Invalid or expired password reset token");
    });

    it("should throw error if token is expired", async () => {
      mockUserRepository.resetPasswordTransaction = mock(() => {
        throw new Error("Invalid or expired password reset token");
      });

      await expect(
        useCase.execute({
          token: "expired-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow("Invalid or expired password reset token");
    });

    it("should throw error if user not found", async () => {
      mockUserRepository.resetPasswordTransaction = mock(() => {
        throw new Error("User not found");
      });

      await expect(
        useCase.execute({
          token: "valid-token",
          newPassword: "newPassword123!",
        })
      ).rejects.toThrow("User not found");
    });
  });
});
