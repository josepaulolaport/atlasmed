import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

mock.module("../../../../infrastructure/monitoring/metrics.service", () => ({
  metricsService: createMockMetricsService(),
}));

import { SuspendUserUseCase } from "./suspend-user.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockUserRepository,
  createMockSessionRepository,
  createMockAuthCache,
  createMockSessionCache,
  createMockScopeService,
} from "../../test-helpers/fixtures";
import { createGlobalScopeContext, Role } from "@atlasmed/access";

function adminSuspendParams(userId: string, suspendedBy = "admin-123") {
  return {
    userId,
    suspendedBy,
    actorRole: Role.ADMIN,
    scope: createGlobalScopeContext(),
  };
}

describe("SuspendUserUseCase", () => {
  let suspendUserUseCase: SuspendUserUseCase;
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

    suspendUserUseCase = new SuspendUserUseCase({
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
      scopeService: mockScopeService,
    });
  });

  describe("user suspension", () => {
    it("should suspend user", async () => {
      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(mockUserRepository.suspend).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.suspend).toHaveBeenCalledWith("user-123");
    });

    it("should revoke all user sessions", async () => {
      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith("user-123", undefined);
    });

    it("should suspend user before revoking sessions", async () => {
      const callOrder: string[] = [];

      mockUserRepository.suspend = mock(async () => {
        callOrder.push("suspend");
      });

      mockSessionRepository.revokeAllByUserId = mock(async () => {
        callOrder.push("revokeSessions");
      });

      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(callOrder).toEqual(["suspend", "revokeSessions"]);
    });

    it("should invalidate auth cache", async () => {
      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should invalidate scope cache", async () => {
      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(mockScopeService.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should invalidate manager scope when user has a manager", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        managerId: "manager-456",
      }));

      await suspendUserUseCase.execute(adminSuspendParams("user-123"));

      expect(mockScopeService.invalidateForManagerChange).toHaveBeenCalledWith({
        userId: "user-123",
        previousManagerId: "manager-456",
        nextManagerId: "manager-456",
      });
      expect(mockScopeService.invalidate).not.toHaveBeenCalled();
    });

    it("should complete successfully when user is suspended", async () => {
      await expect(
        suspendUserUseCase.execute(adminSuspendParams("user-123"))
      ).resolves.toBeUndefined();
    });
  });

  describe("user not found", () => {
    it("should throw error when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      await expect(
        suspendUserUseCase.execute(adminSuspendParams("non-existent"))
      ).rejects.toThrow("User not found");
    });

    it("should not suspend when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await suspendUserUseCase.execute(adminSuspendParams("non-existent"));
      } catch {}

      expect(mockUserRepository.suspend).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user not found", async () => {
      mockUserRepository.findById = mock(async () => null);

      try {
        await suspendUserUseCase.execute(adminSuspendParams("non-existent"));
      } catch {}

      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("already suspended user", () => {
    it("should throw error when user is already suspended", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "SUSPENDED",
      }));

      await expect(
        suspendUserUseCase.execute(adminSuspendParams("user-123"))
      ).rejects.toThrow("User is already suspended");
    });

    it("should not call suspend when user already suspended", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "SUSPENDED",
      }));

      try {
        await suspendUserUseCase.execute(adminSuspendParams("user-123"));
      } catch {}

      expect(mockUserRepository.suspend).not.toHaveBeenCalled();
    });

    it("should not revoke sessions when user already suspended", async () => {
      mockUserRepository.findById = mock(async () => ({
        ...mockUser,
        status: "SUSPENDED",
      }));

      try {
        await suspendUserUseCase.execute(adminSuspendParams("user-123"));
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
        suspendUserUseCase.execute(adminSuspendParams("user-123"))
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when suspend fails", async () => {
      mockUserRepository.suspend = mock(async () => {
        throw new Error("Suspend failed");
      });

      await expect(
        suspendUserUseCase.execute(adminSuspendParams("user-123"))
      ).rejects.toThrow("Suspend failed");
    });

    it("should propagate error when revokeAllByUserId fails", async () => {
      mockSessionRepository.revokeAllByUserId = mock(async () => {
        throw new Error("Revoke sessions failed");
      });

      await expect(
        suspendUserUseCase.execute(adminSuspendParams("user-123"))
      ).rejects.toThrow("Revoke sessions failed");
    });
  });
});
