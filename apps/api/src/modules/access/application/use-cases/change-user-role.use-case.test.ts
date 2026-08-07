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
    user: { id: 123, roleId: 2 },
    role: {
      id: 2,
      name: "REP",
      priority: ROLE_PRIORITY_BY_NAME.REP,
    },
  });

  const adminActor = createMockUserWithRole({
    user: { id: 456 },
    role: {
      id: 1,
      name: "ADMIN",
      priority: ROLE_PRIORITY_BY_NAME.ADMIN,
    },
  });

  const managerRole = {
    id: 3,
    name: "MANAGER",
    priority: ROLE_PRIORITY_BY_NAME.MANAGER,
  };

  beforeEach(() => {
    mockUserRepository = createMockUserRepository({
      findById: mock(async (id: number) => {
        if (id === 123) return targetUser;
        if (id === 456) return adminActor;
        return null;
      }),
    });

    mockRoleRepository = createMockRoleRepository({
      findById: mock(async (roleId: number) => {
        if (roleId === 3) return managerRole;
        if (roleId === 2) {
          return {
            id: 2,
            name: "REP",
            priority: ROLE_PRIORITY_BY_NAME.REP,
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
        targetUserId: 123,
        newRoleId: 3,
        changedBy: 456,
      });

      expect(mockUserRepository.changeRoleTransaction).toHaveBeenCalledWith({
        userId: 123,
        newRoleId: 3,
      });
      expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(123);
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith(123);
      expect(mockScopeService.invalidate).toHaveBeenCalledWith(123);
    });

    it("should not call legacy updateRole or session revoke paths", async () => {
      await changeUserRoleUseCase.execute({
        targetUserId: 123,
        newRoleId: 3,
        changedBy: 456,
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
          targetUserId: 999,
          newRoleId: 3,
          changedBy: 456,
        })
      ).rejects.toThrow(UserNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when actor not found", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 123,
          newRoleId: 3,
          changedBy: 999,
        })
      ).rejects.toThrow(UserNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when role is unchanged", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 123,
          newRoleId: 2,
          changedBy: 456,
        })
      ).rejects.toThrow(OperationNotAllowedError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should throw when new role not found", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 123,
          newRoleId: 999,
          changedBy: 456,
        })
      ).rejects.toThrow(RoleNotFoundError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });
  });

  describe("role assignment ceiling", () => {
    it("should reject assigning a role above the actor", async () => {
      mockUserRepository.findById = mock(async (id: number) => {
        if (id === 123) return targetUser;
        if (id === 3) {
          return createMockUserWithRole({
            user: { id: 3 },
            role: {
              name: "MANAGER",
              priority: ROLE_PRIORITY_BY_NAME.MANAGER,
            },
          });
        }
        return null;
      });

      mockRoleRepository.findById = mock(async () => ({
        id: 1,
        name: "ADMIN",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      }));

      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 123,
          newRoleId: 1,
          changedBy: 3,
        })
      ).rejects.toThrow(InsufficientPermissionsError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should reject changing role of a user above the actor", async () => {
      const adminTarget = createMockUserWithRole({
        user: { id: 5, roleId: 1 },
        role: {
          id: 1,
          name: "ADMIN",
          priority: ROLE_PRIORITY_BY_NAME.ADMIN,
        },
      });

      mockUserRepository.findById = mock(async (id: number) => {
        if (id === 5) return adminTarget;
        if (id === 3) {
          return createMockUserWithRole({
            user: { id: 3 },
            role: {
              name: "MANAGER",
              priority: ROLE_PRIORITY_BY_NAME.MANAGER,
            },
          });
        }
        return null;
      });

      mockRoleRepository.findById = mock(async () => ({
        id: 2,
        name: "REP",
        priority: ROLE_PRIORITY_BY_NAME.REP,
      }));

      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 5,
          newRoleId: 2,
          changedBy: 3,
        })
      ).rejects.toThrow(InsufficientPermissionsError);

      expect(mockUserRepository.changeRoleTransaction).not.toHaveBeenCalled();
    });

    it("should allow admin to change user to manager", async () => {
      await expect(
        changeUserRoleUseCase.execute({
          targetUserId: 123,
          newRoleId: 3,
          changedBy: 456,
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
          targetUserId: 123,
          newRoleId: 3,
          changedBy: 456,
        })
      ).rejects.toThrow("Role change failed");
    });
  });
});
