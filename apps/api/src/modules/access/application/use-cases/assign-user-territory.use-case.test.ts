import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

import { AssignUserTerritoryUseCase } from "./assign-user-territory.use-case";
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

describe("AssignUserTerritoryUseCase", () => {
  const fieldUser = { id: "user-field", role: { name: Role.USER } };
  const managerUser = { id: "user-manager", role: { name: Role.MANAGER } };

  let useCase: AssignUserTerritoryUseCase;
  let userRepository: ReturnType<typeof createMockUserRepository>;
  let scopeRepository: ReturnType<typeof createMockScopeRepository>;
  let scopeService: ReturnType<typeof createMockScopeService>;

  beforeEach(() => {
    userRepository = createMockUserRepository({
      findById: mock(async (id: string) => {
        if (id === fieldUser.id) return fieldUser;
        if (id === managerUser.id) return managerUser;
        return null;
      }),
    });
    scopeRepository = createMockScopeRepository();
    scopeService = createMockScopeService();

    useCase = new AssignUserTerritoryUseCase({
      userRepository,
      scopeRepository,
      scopeService,
    });
  });

  it("assigns territory for USER target when actor is ADMIN", async () => {
    await useCase.execute({
      targetUserId: fieldUser.id,
      territoryId: "territory-a",
      assignedBy: "admin-1",
      actorRole: Role.ADMIN,
    });

    expect(scopeRepository.assignTerritory).toHaveBeenCalledWith({
      userId: fieldUser.id,
      territoryId: "territory-a",
      assignedBy: "admin-1",
    });
    expect(scopeService.invalidateForTerritoryAssignmentChange).toHaveBeenCalledWith(
      fieldUser.id
    );
  });

  it("rejects non-USER target", async () => {
    await expect(
      useCase.execute({
        targetUserId: managerUser.id,
        territoryId: "territory-a",
        assignedBy: "admin-1",
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(OperationNotAllowedError);

    expect(scopeRepository.assignTerritory).not.toHaveBeenCalled();
  });

  it("rejects MANAGER actor", async () => {
    await expect(
      useCase.execute({
        targetUserId: fieldUser.id,
        territoryId: "territory-a",
        assignedBy: "manager-1",
        actorRole: Role.MANAGER,
      })
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it("throws when target not found", async () => {
    userRepository.findById = mock(() => Promise.resolve(null));

    await expect(
      useCase.execute({
        targetUserId: "missing",
        territoryId: "territory-a",
        assignedBy: "admin-1",
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(UserNotFoundError);
  });
});
