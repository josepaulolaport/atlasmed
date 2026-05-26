import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

mock.module("../../../../infrastructure/monitoring/metrics.service", () => ({
  metricsService: createMockMetricsService(),
}));

import { DeactivateUserUseCase } from "./deactivate-user.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { createMockUserRepository, createMockSessionRepository, createMockAuthCache, createMockSessionCache, createMockScopeService } from "../../test-helpers/fixtures";
import { createGlobalScopeContext, Role } from "@atlasmed/access";

function adminDeactivateParams(userId: string, deactivatedBy = "admin-123") {
  return {
    userId,
    deactivatedBy,
    actorRole: Role.ADMIN,
    scope: createGlobalScopeContext(),
  };
}

describe("DeactivateUserUseCase", () => {
  let deactivateUserUseCase: DeactivateUserUseCase;
  let mockUserRepository: UserRepository;
  let mockSessionRepository: SessionRepository;
  let mockAuthCache: IAuthCache;
  let mockSessionCache: ISessionCache;
  let mockScopeService: ReturnType<typeof createMockScopeService>;

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
    mockScopeService = createMockScopeService();

    deactivateUserUseCase = new DeactivateUserUseCase({
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
      scopeService: mockScopeService,
    });
  });

  describe("user deactivation", () => {
    it("should deactivate user", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockUserRepository.deactivate).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.deactivate).toHaveBeenCalledWith("user-123");
    });

    it("should revoke all user sessions", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

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

      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(callOrder).toEqual(["deactivate", "revokeSessions"]);
    });

    it("should complete successfully when user is deactivated", async () => {
      await expect(
        deactivateUserUseCase.execute(adminDeactivateParams("user-123"))
      ).resolves.toBeUndefined();
    });

    it("should invalidate auth cache", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should invalidate scope cache", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockScopeService.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should invalidate manager scope when user has a manager", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        managerId: "manager-456",
      }));

      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockScopeService.invalidateForManagerChange).toHaveBeenCalledWith({
        userId: "user-123",
        previousManagerId: "manager-456",
        nextManagerId: "manager-456",
      });
      expect(mockScopeService.invalidate).not.toHaveBeenCalled();
    });
  });

  describe("user not found", () => {
    it("should throw error when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      await expect(
        deactivateUserUseCase.execute(adminDeactivateParams("non-existent"))
      ).rejects.toThrow("User not found");
    });

    it("should not deactivate when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await deactivateUserUseCase.execute(adminDeactivateParams("non-existent"));
      } catch {}

      expect(mockUserRepository.deactivate).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await deactivateUserUseCase.execute(adminDeactivateParams("non-existent"));
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
        deactivateUserUseCase.execute(adminDeactivateParams("user-123"))
      ).rejects.toThrow("User is already deactivated");
    });

    it("should not call deactivate when user already inactive", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "INACTIVE",
      }));

      try {
        await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));
      } catch {}

      expect(mockUserRepository.deactivate).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user already inactive", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "INACTIVE",
      }));

      try {
        await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));
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
        deactivateUserUseCase.execute(adminDeactivateParams("user-123"))
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when deactivate fails", async () => {
      mockUserRepository.deactivate = mock(async () => {
        throw new Error("Deactivate failed");
      });

      await expect(
        deactivateUserUseCase.execute(adminDeactivateParams("user-123"))
      ).rejects.toThrow("Deactivate failed");
    });

    it("should propagate error when revokeAllByUserId fails", async () => {
      mockSessionRepository.revokeAllByUserId = mock(async () => {
        throw new Error("Revoke sessions failed");
      });

      await expect(
        deactivateUserUseCase.execute(adminDeactivateParams("user-123"))
      ).rejects.toThrow("Revoke sessions failed");
    });
  });

  describe("access immediately invalidated", () => {
    it("should revoke all sessions for the user", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith("user-123", undefined);
    });

    it("should ensure no active sessions remain after deactivation", async () => {
      await deactivateUserUseCase.execute(adminDeactivateParams("user-123"));

      expect(mockUserRepository.deactivate).toHaveBeenCalled();
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalled();
    });
  });
});
