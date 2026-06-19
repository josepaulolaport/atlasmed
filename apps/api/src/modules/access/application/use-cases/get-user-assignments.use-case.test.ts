import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";

import { GetUserAssignmentsUseCase } from "./get-user-assignments.use-case";
import { createMockUserRepository } from "../../test-helpers/repository-mocks";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";
import { createMockScopeRepository } from "../../test-helpers/repository-mocks";

describe("GetUserAssignmentsUseCase", () => {
  it("returns assignments with manager details and operational status for USER with territories", async () => {
    const assignedAt = new Date("2025-01-15T10:00:00.000Z");

    const userRepository = createMockUserRepository({
      findById: mock(async (id: string) => {
        if (id === "user-1") {
          return {
            id: "user-1",
            managerId: "manager-1",
            username: "fielduser",
            email: "field@example.com",
            role: { name: Role.USER },
          };
        }
        if (id === "manager-1") {
          return {
            id: "manager-1",
            username: "mgr",
            email: "mgr@example.com",
            firstName: "Jane",
            lastName: "Manager",
            role: { name: Role.MANAGER },
          };
        }
        return null;
      }),
    });

    const scopeRepository = createMockScopeRepository({
      findTerritoryAssignmentsByUserId: mock(() =>
        Promise.resolve([{ territoryId: "territory-a", assignedAt }])
      ),
    });

    const useCase = new GetUserAssignmentsUseCase({ userRepository, scopeRepository });
    const result = await useCase.execute({
      targetUserId: "user-1",
      actorRole: Role.ADMIN,
    });

    expect(result).toEqual({
      userId: "user-1",
      managerId: "manager-1",
      manager: {
        id: "manager-1",
        username: "mgr",
        email: "mgr@example.com",
        firstName: "Jane",
        lastName: "Manager",
      },
      territories: [{ territoryId: "territory-a", assignedAt: assignedAt.toISOString() }],
      isOperationallyActive: true,
    });
  });

  it("returns inactive operational status for USER without territories", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: "user-2",
          managerId: null,
          username: "unassigned",
          email: "u@example.com",
          role: { name: Role.USER },
        })
      ),
    });

    const scopeRepository = createMockScopeRepository();
    const useCase = new GetUserAssignmentsUseCase({ userRepository, scopeRepository });
    const result = await useCase.execute({
      targetUserId: "user-2",
      actorRole: Role.ADMIN,
    });

    expect(result.managerId).toBeNull();
    expect(result.manager).toBeNull();
    expect(result.territories).toEqual([]);
    expect(result.isOperationallyActive).toBe(false);
  });

  it("returns isOperationallyActive false for non-USER roles even with territories", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: "manager-1",
          managerId: null,
          username: "mgr",
          email: "mgr@example.com",
          role: { name: Role.MANAGER },
        })
      ),
    });

    const scopeRepository = createMockScopeRepository({
      findTerritoryAssignmentsByUserId: mock(() =>
        Promise.resolve([{ territoryId: "territory-x", assignedAt: new Date() }])
      ),
    });

    const useCase = new GetUserAssignmentsUseCase({ userRepository, scopeRepository });
    const result = await useCase.execute({
      targetUserId: "manager-1",
      actorRole: Role.ADMIN,
    });

    expect(result.isOperationallyActive).toBe(false);
    expect(result.territories).toHaveLength(1);
  });

  it("throws UserNotFoundError when user does not exist", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() => Promise.resolve(null)),
    });
    const scopeRepository = createMockScopeRepository();

    const useCase = new GetUserAssignmentsUseCase({ userRepository, scopeRepository });

    await expect(
      useCase.execute({ targetUserId: "missing", actorRole: Role.ADMIN })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("rejects non-ADMIN actor", async () => {
    const userRepository = createMockUserRepository();
    const scopeRepository = createMockScopeRepository();
    const useCase = new GetUserAssignmentsUseCase({ userRepository, scopeRepository });

    await expect(
      useCase.execute({ targetUserId: "user-1", actorRole: Role.MANAGER })
    ).rejects.toThrow(InsufficientPermissionsError);
  });
});
