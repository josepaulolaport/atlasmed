import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";

import { GetUserAssignmentsUseCase } from "./get-user-assignments.use-case";
import {
  createMockUserRepository,
  createMockScopeRepository,
} from "../../test-helpers/repository-mocks";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("GetUserAssignmentsUseCase", () => {
  const territoryRepository = {
    findByIds: mock(async (ids: string[]) =>
      ids.map((id) => ({
        id,
        name: `Territory ${id}`,
        slug: id,
        code: id,
        territoryTypeId: "type-1",
        managerTerritoryId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ),
  } as any;

  const spatialRepository = {
    getBoundaryAsGeoJson: mock(async () => ({
      type: "MultiPolygon",
      coordinates: [],
    })),
  } as any;

  it("returns invite-shaped vertical assignments for REP with territories", async () => {
    const assignedAt = new Date("2025-01-15T10:00:00.000Z");

    const userRepository = createMockUserRepository({
      findById: mock(async (id: string) => {
        if (id === "user-1") {
          return {
            id: "user-1",
            managerId: "manager-1",
            username: "fielduser",
            email: "field@example.com",
            role: { name: Role.REP },
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
      }) as any,
    });

    const scopeRepository = createMockScopeRepository({
      findVerticalAssignmentsByUserId: mock(() =>
        Promise.resolve([
          {
            verticalId: "vertical-1",
            managerId: "manager-1",
            assignedAt,
          },
        ]),
      ),
      findTerritoryAssignmentsByUserId: mock(() =>
        Promise.resolve([{ territoryId: "territory-a", assignedAt }]),
      ),
      listActiveVerticals: mock(() =>
        Promise.resolve([
          { id: "vertical-1", code: "ORTOPEDIA", name: "Ortopedia" },
        ]),
      ),
    });

    const useCase = new GetUserAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
      spatialRepository,
    });
    const result = await useCase.execute({
      targetUserId: "user-1",
      actorRole: Role.ADMIN,
    });

    expect(result.userId).toBe("user-1");
    expect(result.isOperationallyActive).toBe(true);
    expect(result.verticalAssignments).toHaveLength(1);
    expect(result.verticalAssignments[0]).toMatchObject({
      verticalId: "vertical-1",
      verticalName: "Ortopedia",
      managerId: "manager-1",
      managerName: "Jane Manager",
    });
    expect(result.verticalAssignments[0]!.territories[0]).toMatchObject({
      id: "territory-a",
      name: "Territory territory-a",
    });
  });

  it("returns inactive operational status for REP without territories", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: "user-2",
          managerId: null,
          username: "unassigned",
          email: "u@example.com",
          role: { name: Role.REP },
        }),
      ) as any,
    });

    const scopeRepository = createMockScopeRepository({
      listActiveVerticals: mock(() => Promise.resolve([])),
    });
    const useCase = new GetUserAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
      spatialRepository,
    });
    const result = await useCase.execute({
      targetUserId: "user-2",
      actorRole: Role.ADMIN,
    });

    expect(result.verticalAssignments).toEqual([]);
    expect(result.isOperationallyActive).toBe(false);
  });

  it("rejects non-admin actors", async () => {
    const useCase = new GetUserAssignmentsUseCase({
      userRepository: createMockUserRepository(),
      scopeRepository: createMockScopeRepository(),
      territoryRepository,
      spatialRepository,
    });

    await expect(
      useCase.execute({
        targetUserId: "user-1",
        actorRole: Role.MANAGER,
      }),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it("throws when user is missing", async () => {
    const useCase = new GetUserAssignmentsUseCase({
      userRepository: createMockUserRepository(),
      scopeRepository: createMockScopeRepository(),
      territoryRepository,
      spatialRepository,
    });

    await expect(
      useCase.execute({
        targetUserId: "missing",
        actorRole: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
