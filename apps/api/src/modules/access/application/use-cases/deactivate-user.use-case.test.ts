import { beforeEach, describe, expect, it, mock } from "bun:test";
import { DeactivateUserUseCase } from "./deactivate-user.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { createMockUserRepository, createMockSessionRepository, createMockAuthCache, createMockSessionCache } from "../../test-helpers/fixtures";

describe("DeactivateUserUseCase", () => {
  let deactivateUserUseCase: DeactivateUserUseCase;
  let mockUserRepository: UserRepository;
  let mockSessionRepository: SessionRepository;
  let mockAuthCache: IAuthCache;
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

  beforeEach(() => {
    mockUserRepository = createMockUserRepository({
      findById: mock(async () => mockUser),
    });

    mockSessionRepository = createMockSessionRepository();
    mockAuthCache = createMockAuthCache();
    mockSessionCache = createMockSessionCache();

    deactivateUserUseCase = new DeactivateUserUseCase({
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
    });
  });

  describe("user deactivation", () => {
    it("should deactivate user", async () => {
      await deactivateUserUseCase.execute({ userId: "user-123" });

      expect(mockUserRepository.deactivate).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.deactivate).toHaveBeenCalledWith("user-123");
    });

    it("should revoke all user sessions", async () => {
      await deactivateUserUseCase.execute({ userId: "user-123" });

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith("user-123", undefined);
    });

    it("should deactivate user before revoking sessions", async () => {
      const callOrder: string[] = [];

      mockUserRepository.deactivate = mock(async () => {
        callOrder.push("deactivate");
      });

      mockSessionRepository.revokeAllByUserId = mock(async () => {
        callOrder.push("revokeSessions");
      });

      await deactivateUserUseCase.execute({ userId: "user-123" });

      expect(callOrder).toEqual(["deactivate", "revokeSessions"]);
    });

    it("should complete successfully when user is deactivated", async () => {
      await expect(
        deactivateUserUseCase.execute({ userId: "user-123" })
      ).resolves.toBeUndefined();
    });
  });

  describe("user not found", () => {
    it("should throw error when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      await expect(
        deactivateUserUseCase.execute({ userId: "non-existent" })
      ).rejects.toThrow("User not found");
    });

    it("should not deactivate when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await deactivateUserUseCase.execute({ userId: "non-existent" });
      } catch {}

      expect(mockUserRepository.deactivate).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await deactivateUserUseCase.execute({ userId: "non-existent" });
      } catch {}

      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("already deactivated user", () => {
    it("should throw error when user is already deactivated", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "INACTIVE",
      }));

      await expect(
        deactivateUserUseCase.execute({ userId: "user-123" })
      ).rejects.toThrow("User is already deactivated");
    });

    it("should not call deactivate when user already inactive", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "INACTIVE",
      }));

      try {
        await deactivateUserUseCase.execute({ userId: "user-123" });
      } catch {}

      expect(mockUserRepository.deactivate).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user already inactive", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "INACTIVE",
      }));

      try {
        await deactivateUserUseCase.execute({ userId: "user-123" });
      } catch {}

      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findById fails", async () => {
      mockUserRepository.findById = mock(async () => {
        throw new Error("Database error");
      });

      await expect(
        deactivateUserUseCase.execute({ userId: "user-123" })
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when deactivate fails", async () => {
      mockUserRepository.deactivate = mock(async () => {
        throw new Error("Deactivate failed");
      });

      await expect(
        deactivateUserUseCase.execute({ userId: "user-123" })
      ).rejects.toThrow("Deactivate failed");
    });

    it("should propagate error when revokeAllByUserId fails", async () => {
      mockSessionRepository.revokeAllByUserId = mock(async () => {
        throw new Error("Revoke sessions failed");
      });

      await expect(
        deactivateUserUseCase.execute({ userId: "user-123" })
      ).rejects.toThrow("Revoke sessions failed");
    });
  });

  describe("access immediately invalidated", () => {
    it("should revoke all sessions for the user", async () => {
      await deactivateUserUseCase.execute({ userId: "user-123" });

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith("user-123", undefined);
    });

    it("should ensure no active sessions remain after deactivation", async () => {
      await deactivateUserUseCase.execute({ userId: "user-123" });

      expect(mockUserRepository.deactivate).toHaveBeenCalled();
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalled();
    });
  });
});
