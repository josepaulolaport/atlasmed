import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

import { AssignUserManagerUseCase } from "./assign-user-manager.use-case";
import {
  createMockUserRepository,
  createMockScopeRepository,
} from "../../test-helpers/repository-mocks";
import { createMockScopeService } from "../../test-helpers/fixtures";
import {
  InsufficientPermissionsError,
  OperationNotAllowedError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("AssignUserManagerUseCase", () => {
  const targetUser = {
    id: "user-target",
    managerId: null,
    role: { name: Role.USER },
  };

  const managerUser = {
    id: "manager-1",
    role: { name: Role.MANAGER },
  };

  let useCase: AssignUserManagerUseCase;
  let userRepository: ReturnType<typeof createMockUserRepository>;
  let scopeRepository: ReturnType<typeof createMockScopeRepository>;
  let scopeService: ReturnType<typeof createMockScopeService>;

  beforeEach(() => {
    userRepository = createMockUserRepository({
      findById: mock(async (id: string) => {
        if (id === targetUser.id) return targetUser;
        if (id === managerUser.id) return managerUser;
        return null;
      }),
      updateManagerId: mock(() => Promise.resolve({})),
    });
    scopeRepository = createMockScopeRepository();
    scopeService = createMockScopeService();

    useCase = new AssignUserManagerUseCase({
      userRepository,
      scopeRepository,
      scopeService,
      auditLog: createMockAuditLogService(),
    });
  });

  it("assigns manager when actor is ADMIN", async () => {
    await useCase.execute({
      targetUserId: targetUser.id,
      managerId: managerUser.id,
      assignedBy: "admin-1",
      actorRole: Role.ADMIN,
    });

    expect(userRepository.updateManagerId).toHaveBeenCalledWith(targetUser.id, managerUser.id);
    expect(scopeService.invalidateForManagerChange).toHaveBeenCalled();
  });

  it("clears manager when managerId is null", async () => {
    userRepository.findById = mock(async (id: string) => {
      if (id === targetUser.id) return { ...targetUser, managerId: managerUser.id };
      return null;
    });

    await useCase.execute({
      targetUserId: targetUser.id,
      managerId: null,
      assignedBy: "admin-1",
      actorRole: Role.ADMIN,
    });

    expect(userRepository.updateManagerId).toHaveBeenCalledWith(targetUser.id, null);
  });

  it("rejects MANAGER actor", async () => {
    await expect(
      useCase.execute({
        targetUserId: targetUser.id,
        managerId: managerUser.id,
        assignedBy: "manager-1",
        actorRole: Role.MANAGER,
      })
    ).rejects.toThrow(InsufficientPermissionsError);

    expect(userRepository.updateManagerId).not.toHaveBeenCalled();
  });

  it("throws when target user not found", async () => {
    userRepository.findById = mock(() => Promise.resolve(null));

    await expect(
      useCase.execute({
        targetUserId: "missing",
        managerId: managerUser.id,
        assignedBy: "admin-1",
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("rejects self-assignment", async () => {
    await expect(
      useCase.execute({
        targetUserId: targetUser.id,
        managerId: targetUser.id,
        assignedBy: "admin-1",
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });

  it("rejects manager with USER role", async () => {
    userRepository.findById = mock(async (id: string) => {
      if (id === targetUser.id) return targetUser;
      if (id === "bad-manager") return { id: "bad-manager", role: { name: Role.USER } };
      return null;
    });

    await expect(
      useCase.execute({
        targetUserId: targetUser.id,
        managerId: "bad-manager",
        assignedBy: "admin-1",
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
