import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";

import { GetTerritoryAssignmentsUseCase } from "./get-territory-assignments.use-case";
import {
  createMockUserRepository,
  createMockScopeRepository,
} from "../../test-helpers/repository-mocks";
import { ResourceNotFoundError } from "../../../../shared/errors";

describe("GetTerritoryAssignmentsUseCase", () => {
  it("returns assigned users ordered by most recent assignment", async () => {
    const assignedAt = new Date("2025-01-15T10:00:00.000Z");

    const userRepository = createMockUserRepository({
      findById: mock(async (id: number) => {
        if (id === 1) {
          return {
            id: 1,
            username: "rep1",
            email: "rep1@example.com",
            firstName: "Rep",
            lastName: "One",
            avatarUrl: null,
            role: { id: 3, name: Role.REP },
          };
        }
        return null;
      }) as any,
    });

    const scopeRepository = createMockScopeRepository({
      findUserIdsByTerritoryId: mock(() =>
        Promise.resolve([{ userId: 1, assignedAt }])
      ),
    });

    const territoryRepository = {
      findById: mock(async () => ({ id: 1 })),
    };

    const useCase = new GetTerritoryAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
    });

    const result = await useCase.execute(1);

    expect(result).toEqual([
      {
        userId: 1,
        username: "rep1",
        email: "rep1@example.com",
        firstName: "Rep",
        lastName: "One",
        avatarUrl: null,
        role: { id: 3, name: Role.REP },
        assignedAt: assignedAt.toISOString(),
      },
    ]);
  });

  it("skips assignments whose user record no longer exists", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() => Promise.resolve(null)),
    });
    const scopeRepository = createMockScopeRepository({
      findUserIdsByTerritoryId: mock(() =>
        Promise.resolve([{ userId: 999, assignedAt: new Date() }])
      ),
    });
    const territoryRepository = {
      findById: mock(async () => ({ id: 1 })),
    };

    const useCase = new GetTerritoryAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
    });

    const result = await useCase.execute(1);

    expect(result).toEqual([]);
  });

  it("throws ResourceNotFoundError when territory does not exist", async () => {
    const userRepository = createMockUserRepository();
    const scopeRepository = createMockScopeRepository();
    const territoryRepository = {
      findById: mock(async () => null),
    };

    const useCase = new GetTerritoryAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
    });

    await expect(useCase.execute(999)).rejects.toThrow(ResourceNotFoundError);
  });
});
