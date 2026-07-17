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
      findById: mock(async (id: string) => {
        if (id === "user-1") {
          return {
            id: "user-1",
            username: "rep1",
            email: "rep1@example.com",
            firstName: "Rep",
            lastName: "One",
            avatarUrl: null,
            role: { id: "role-rep", name: Role.REP },
          };
        }
        return null;
      }) as any,
    });

    const scopeRepository = createMockScopeRepository({
      findUserIdsByTerritoryId: mock(() =>
        Promise.resolve([{ userId: "user-1", assignedAt }])
      ),
    });

    const territoryRepository = {
      findById: mock(async () => ({ id: "territory-a" })),
    };

    const useCase = new GetTerritoryAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
    });

    const result = await useCase.execute("territory-a");

    expect(result).toEqual([
      {
        userId: "user-1",
        username: "rep1",
        email: "rep1@example.com",
        firstName: "Rep",
        lastName: "One",
        avatarUrl: null,
        role: { id: "role-rep", name: Role.REP },
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
        Promise.resolve([{ userId: "ghost", assignedAt: new Date() }])
      ),
    });
    const territoryRepository = {
      findById: mock(async () => ({ id: "territory-a" })),
    };

    const useCase = new GetTerritoryAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
    });

    const result = await useCase.execute("territory-a");

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

    await expect(useCase.execute("missing")).rejects.toThrow(ResourceNotFoundError);
  });
});
