import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

mock.module("../../../../infrastructure/monitoring/metrics.service", () => ({
  metricsService: createMockMetricsService(),
}));

import { ChangeUserRoleUseCase } from "./change-user-role.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockUserRepository,
  createMockRoleRepository,
  createMockSessionRepository,
  createMockAuthCache,
  createMockSessionCache,
  createMockScopeService,
  createMockUserWithRole,
} from "../../test-helpers/fixtures";
import { ROLE_PRIORITY_BY_NAME } from "../constants/role-priority.constants";
import {
  InsufficientPermissionsError,
  OperationNotAllowedError,
  RoleNotFoundError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("ChangeUserRoleUseCase", () => {
  let changeUserRoleUseCase: ChangeUserRoleUseCase;
  let mockUserRepository: UserRepository;
  let mockRoleRepository: RoleRepository;
  let mockSessionRepository: SessionRepository;
  let mockAuthCache: IAuthCache;
  let mockSessionCache: ISessionCache;
  let mockScopeService: ReturnType<typeof createMockScopeService>;

  const targetUser = createMockUserWithRole({
    user: { id: "user-123", roleId: "role-user" },
    role: {
      id: "role-user",
      name: "USER",
      priority: ROLE_PRIORITY_BY_NAME.USER,
    },
  });

  const adminActor = createMockUserWithRole({
    user: { id: "admin-456" },
    role: {
      id: "role-admin",
      name: "ADMIN",
      priority: ROLE_PRIORITY_BY_NAME.ADMIN,
    },
  });

  const managerRole = {
    id: "role-manager",
    name: "MANAGER",
    priority: ROLE_PRIORITY_BY_NAME.MANAGER,
  };

  beforeEach(() => {
    mockUserRepository = createMockUserRepository({
      findById: mock(async (id: string) => {
        if (id === "user-123") return targetUser;
        if (id === "admin-456") return adminActor;
        return null;
      }),
    });

    mockRoleRepository = createMockRoleRepository({
      findById: mock(async (roleId: string) => {
        if (roleId === "role-manager") return managerRole;
        if (roleId === "role-user") {
          return {
            id: "role-user",
            name: "USER",
            priority: ROLE_PRIORITY_BY_NAME.USER,
          };
        }
        return null;
      }),
    });

    mockSessionRepository = createMockSessionRepository();
    mockAuthCache = createMockAuthCache();
    mockSessionCache = createMockSessionCache();
    mockScopeService = createMockScopeService();

    changeUserRoleUseCase = new ChangeUserRoleUseCase({
      userRepository: mockUserRepository,
      roleRepository: mockRoleRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
      scopeService: mockScopeService,
      auditLog: createMockAuditLogService(),
      metrics: createMockMetricsService(),
    });
  });

  describe("successful role change", () => {
    it("should change role via transaction and invalidate caches", async () => {
      await changeUserRoleUseCase.execute({
        targetUserId: "user-123",
        newRoleId: "role-manager",
        changedBy: "admin-456",
      });

      expect(mockUserRepository.changeRoleTransaction).toHaveBeenCalledWith({
        userId: "user-123",
        newRoleId: "role-manager",
      });
      expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith("user-123");
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
      expect(mockScopeService.invalidate).toHaveBeenCalledWith("user-123");
    });

    it("should not call legacy updateRole or session revoke paths", async () => {
      await changeUserRoleUseCase.execute({
        targetUserId: "user-123",
        newRoleId: "role-manager",
        changedBy: "admin-456",
      });

      expect(mockUserRepository.updateRole).not.toHaveBeenCalled();
      expect(mockUserRepository.incrementTokenVersion).not.toHaveBeenCalled();
      expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("should throw when target user not found", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "missing-user",
          newRoleId: "role-manager",
          changedBy: "admin-456",
        })
      ).rejects.toThrow(UserNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when actor not found", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "role-manager",
          changedBy: "missing-admin",
        })
      ).rejects.toThrow(UserNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when role is unchanged", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "role-user",
          changedBy: "admin-456",
        })
      ).rejects.toThrow(OperationNotAllowedError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when new role not found", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "invalid-role",
          changedBy: "admin-456",
        })
      ).rejects.toThrow(RoleNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });
  });

  describe("role assignment ceiling", () => {
    it("should reject assigning a role above the actor", async () => {
      mockUserRepository.findById = mock(async (id: string) => {
        if (id === "user-123") return targetUser;
        if (id === "manager-123") {
          return createMockUserWithRole({
            user: { id: "manager-123" },
            role: {
              name: "MANAGER",
              priority: ROLE_PRIORITY_BY_NAME.MANAGER,
            },
          });
        }
        return null;
      });

      mockRoleRepository.findById = mock(async () => ({
        id: "role-admin",
        name: "ADMIN",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      }));

      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "role-admin",
          changedBy: "manager-123",
        })
      ).rejects.toThrow(InsufficientPermissionsError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should reject changing role of a user above the actor", async () => {
      const adminTarget = createMockUserWithRole({
        user: { id: "admin-target", roleId: "role-admin" },
        role: {
          id: "role-admin",
          name: "ADMIN",
          priority: ROLE_PRIORITY_BY_NAME.ADMIN,
        },
      });

      mockUserRepository.findById = mock(async (id: string) => {
        if (id === "admin-target") return adminTarget;
        if (id === "manager-123") {
          return createMockUserWithRole({
            user: { id: "manager-123" },
            role: {
              name: "MANAGER",
              priority: ROLE_PRIORITY_BY_NAME.MANAGER,
            },
          });
        }
        return null;
      });

      mockRoleRepository.findById = mock(async () => ({
        id: "role-user",
        name: "USER",
        priority: ROLE_PRIORITY_BY_NAME.USER,
      }));

      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "admin-target",
          newRoleId: "role-user",
          changedBy: "manager-123",
        })
      ).rejects.toThrow(InsufficientPermissionsError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should allow admin to change user to manager", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "role-manager",
          changedBy: "admin-456",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when changeRoleTransaction fails", async () => {
      mockUserRepository.changeRoleTransaction = mock(async () => {
        throw new Error("Role change failed");
      });

      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: "user-123",
          newRoleId: "role-manager",
          changedBy: "admin-456",
        })
      ).rejects.toThrow("Role change failed");
    });
  });
});
