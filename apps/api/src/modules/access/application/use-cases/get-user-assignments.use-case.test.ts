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
    findByIds: mock(async (ids: number[]) =>
      ids.map((id) => {
        if (id === 10) {
          return {
            id: 10,
            name: "Zona Sul",
            slug: "zone-1",
            code: "ZONE-1",
            verticalId: 1,
            territoryTypeId: 1,
            territoryType: { slug: "manager_zone" },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return {
          id,
          name: `Territory ${id}`,
          slug: String(id),
          code: String(id),
          verticalId: 1,
          territoryTypeId: 2,
          territoryType: { slug: "patch" },
          managerTerritoryId: id === 20 ? 10 : null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    ),
  } as any;

  const spatialRepository = {
    getBoundaryAsGeoJson: mock(async () => ({
      type: "MultiPolygon",
      coordinates: [],
    })),
  } as any;

  it("returns territory-derived managers for REP with patches", async () => {
    const assignedAt = new Date("2025-01-15T10:00:00.000Z");

    const userRepository = createMockUserRepository({
      findById: mock(async (id: number) => {
        if (id === 1) {
          return {
            id: 1,
            username: "fielduser",
            email: "field@example.com",
            role: { name: Role.REP },
          };
        }
        if (id === 11) {
          return {
            id: 11,
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
            verticalId: 1,
            managerId: null,
            assignedAt,
          },
        ]),
      ),
      findTerritoryAssignmentsByUserId: mock(() =>
        Promise.resolve([{ territoryId: 20, assignedAt }]),
      ),
      findUserIdsByTerritoryId: mock(async (territoryId: number) => {
        if (territoryId === 10) {
          return [{ userId: 11, assignedAt }];
        }
        return [];
      }),
      listActiveVerticals: mock(() =>
        Promise.resolve([
          { id: 1, code: "ORTOPEDIA", name: "Ortopedia" },
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
      targetUserId: 1,
      actorRole: Role.ADMIN,
    });

    expect(result.userId).toBe(1);
    expect(result.isOperationallyActive).toBe(true);
    expect(result.verticalAssignments).toHaveLength(1);
    expect(result.verticalAssignments[0]).toMatchObject({
      verticalId: 1,
      verticalName: "Ortopedia",
      managerName: "Jane Manager",
      managers: [{ id: 11, name: "Jane Manager" }],
    });
    expect(result.verticalAssignments[0]!.territories[0]).toMatchObject({
      id: 20,
      name: "Territory 20",
      managerZoneId: 10,
      managerZoneName: "Zona Sul",
    });
  });

  it("derives vertical assignments from territories when UVAs missing", async () => {
    const assignedAt = new Date("2025-01-15T10:00:00.000Z");
    const userRepository = createMockUserRepository({
      findById: mock(async (id: number) => {
        if (id === 1) {
          return {
            id: 1,
            username: "fielduser",
            email: "field@example.com",
            role: { name: Role.REP },
          };
        }
        if (id === 11) {
          return {
            id: 11,
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
      findVerticalAssignmentsByUserId: mock(() => Promise.resolve([])),
      findTerritoryAssignmentsByUserId: mock(() =>
        Promise.resolve([{ territoryId: 20, assignedAt }]),
      ),
      findUserIdsByTerritoryId: mock(async (territoryId: number) => {
        if (territoryId === 10) {
          return [{ userId: 11, assignedAt }];
        }
        return [];
      }),
      listActiveVerticals: mock(() =>
        Promise.resolve([
          { id: 1, code: "ORTOPEDIA", name: "Ortopedia" },
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
      targetUserId: 1,
      actorRole: Role.ADMIN,
    });

    expect(result.verticalAssignments).toHaveLength(1);
    expect(result.verticalAssignments[0]).toMatchObject({
      verticalId: 1,
      verticalName: "Ortopedia",
    });
  });

  it("returns inactive operational status for REP without territories", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: 2,
          username: "unassigned",
          email: "u@example.com",
          role: { name: Role.REP },
        }),
      ) as any,
    });
    const scopeRepository = createMockScopeRepository({
      findVerticalAssignmentsByUserId: mock(() => Promise.resolve([])),
      findTerritoryAssignmentsByUserId: mock(() => Promise.resolve([])),
      listActiveVerticals: mock(() => Promise.resolve([])),
    });

    const useCase = new GetUserAssignmentsUseCase({
      userRepository,
      scopeRepository,
      territoryRepository,
      spatialRepository,
    });
    const result = await useCase.execute({
      targetUserId: 2,
      actorRole: Role.ADMIN,
    });
    expect(result.isOperationallyActive).toBe(false);
  });

  it("rejects non-admin actors for other users", async () => {
    const useCase = new GetUserAssignmentsUseCase({
      userRepository: createMockUserRepository(),
      scopeRepository: createMockScopeRepository(),
      territoryRepository,
      spatialRepository,
    });
    await expect(
      useCase.execute({
        targetUserId: 1,
        actorRole: Role.MANAGER,
      }),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it("throws when user missing", async () => {
    const useCase = new GetUserAssignmentsUseCase({
      userRepository: createMockUserRepository({
        findById: mock(() => Promise.resolve(null)),
      }),
      scopeRepository: createMockScopeRepository(),
      territoryRepository,
      spatialRepository,
    });
    await expect(
      useCase.execute({
        targetUserId: 123,
        actorRole: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
