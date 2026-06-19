import { describe, expect, it, mock } from "bun:test";
import { ListUsersUseCase } from "./list-users.use-case";
import { createMockUserRepository } from "../../test-helpers/repository-mocks";
import { createEmptyScopeContext, createGlobalScopeContext } from "@atlasmed/access";

describe("ListUsersUseCase", () => {
  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
    status: "ACTIVE",
    emailVerified: true,
    phoneVerified: false,
    emailVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    phoneVerifiedAt: null,
    role: {
      id: "role-123",
      name: "USER",
      description: "Standard user",
    },
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  };

  it("should return paginated users with serialized dates", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() =>
        Promise.resolve({
          users: [mockUser],
          total: 1,
        })
      ),
    });

    const useCase = new ListUsersUseCase({ userRepository });
    const result = await useCase.execute({ page: 1, limit: 10, scope: createGlobalScopeContext() });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: undefined,
      search: undefined,
      scope: { isGlobal: true, territoryIds: [] },
    });

    expect(result).toEqual({
      data: [
        {
          id: "user-123",
          email: "user@example.com",
          username: "testuser",
          phoneNumber: undefined,
          firstName: "Test",
          lastName: "User",
          avatarUrl: undefined,
          status: "ACTIVE",
          emailVerified: true,
          phoneVerified: false,
          emailVerifiedAt: "2024-01-01T00:00:00.000Z",
          phoneVerifiedAt: undefined,
          role: {
            id: "role-123",
            name: "USER",
            description: "Standard user",
          },
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("should use default pagination values", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    });

    const useCase = new ListUsersUseCase({ userRepository });
    await useCase.execute({ scope: createGlobalScopeContext() });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
      search: undefined,
      scope: { isGlobal: true, territoryIds: [] },
    });
  });

  it("should pass status and search filters", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    });

    const useCase = new ListUsersUseCase({ userRepository });
    await useCase.execute({ status: "ACTIVE", search: "test", scope: createGlobalScopeContext() });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      search: "test",
      scope: { isGlobal: true, territoryIds: [] },
    });
  });

  it("should pass managedUserIds and territoryIds for scoped managers", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    });

    const scope = {
      isGlobal: false,
      territoryIds: ["territory-1"],
      clinicIds: [],
      managedUserIds: ["report-1", "report-2"],
      isOperationallyActive: true,
    };

    const useCase = new ListUsersUseCase({ userRepository });
    await useCase.execute({ scope });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
      search: undefined,
      scope: {
        isGlobal: false,
        territoryIds: ["territory-1"],
        managedUserIds: ["report-1", "report-2"],
      },
    });
  });

  it("should scope manager listing to managedUserIds only, not territory peers", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    });

    const scope = {
      isGlobal: false,
      territoryIds: ["territory-shared"],
      clinicIds: [],
      managedUserIds: ["direct-report-1"],
      isOperationallyActive: true,
    };

    const useCase = new ListUsersUseCase({ userRepository });
    await useCase.execute({ scope });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
      search: undefined,
      scope: {
        isGlobal: false,
        territoryIds: ["territory-shared"],
        managedUserIds: ["direct-report-1"],
      },
    });

    const firstCall = (userRepository.findAll as ReturnType<typeof mock>).mock.calls[0];
    expect(firstCall).toBeDefined();
    const callScope = firstCall![0].scope;
    expect(callScope.managedUserIds).toEqual(["direct-report-1"]);
    expect(callScope.isGlobal).toBe(false);
  });

  it("should pass empty managedUserIds when scope has none", async () => {
    const userRepository = createMockUserRepository({
      findAll: mock(() => Promise.resolve({ users: [], total: 0 })),
    });

    const useCase = new ListUsersUseCase({ userRepository });
    await useCase.execute({ scope: createEmptyScopeContext() });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
      search: undefined,
      scope: {
        isGlobal: false,
        territoryIds: [],
        managedUserIds: [],
      },
    });
  });
});
