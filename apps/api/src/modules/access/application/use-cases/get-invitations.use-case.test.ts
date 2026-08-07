import { describe, expect, it, mock } from "bun:test";
import { GetInvitationsUseCase } from "./get-invitations.use-case";
import {
  createMockInviteRepository,
  createMockUserRepository,
  createMockScopeRepository,
} from "../../test-helpers/repository-mocks";
import { createGlobalScopeContext, Role } from "@atlasmed/access";
import { scopedManagerContext } from "../../test-helpers/route-test-context";
import { InsufficientPermissionsError } from "../../../../shared/errors";

describe("GetInvitationsUseCase", () => {
  const mockInvite = {
    id: 1,
    email: "new@example.com",
    phoneNumber: null,
    status: "PENDING",
    expiresAt: new Date("2025-12-31"),
    createdAt: new Date("2025-01-01"),
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: 1,
    role: { id: 1, name: "USER" },
    firstName: "New",
    lastName: "User",
    acceptedByUserId: null,
    resendCount: 0,
    lastResendAt: null,
    updatedAt: new Date("2025-01-01"),
    roleId: 1,
  };

  const territoryRepository = {
    findByIds: mock(async () => []),
  } as any;

  const deps = () => ({
    inviteRepository: createMockInviteRepository(),
    userRepository: createMockUserRepository(),
    scopeRepository: createMockScopeRepository(),
    territoryRepository,
  });

  it("should reject USER role", async () => {
    const useCase = new GetInvitationsUseCase(deps());

    await expect(
      useCase.execute({
        actorId: 1,
        actorRole: Role.REP,
        scope: createGlobalScopeContext(),
      })
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it("should list all invitations for global admin scope", async () => {
    const findAll = mock(() =>
      Promise.resolve({ invitations: [mockInvite], total: 1 })
    ) as any;
    const inviteRepository = createMockInviteRepository({ findAll });
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: 1,
          username: "mgr",
          email: "mgr@example.com",
          firstName: "M",
          lastName: "G",
        })
      ) as any,
    });

    const useCase = new GetInvitationsUseCase({
      ...deps(),
      inviteRepository,
      userRepository,
    });
    await useCase.execute({
      actorId: 1,
      actorRole: Role.ADMIN,
      scope: createGlobalScopeContext(),
    });

    expect(findAll).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      limit: 20,
    });
  });

  it("should filter by invitedByUserId for managers", async () => {
    const findAll = mock(() => Promise.resolve({ invitations: [], total: 0 }));
    const inviteRepository = createMockInviteRepository({ findAll });

    const useCase = new GetInvitationsUseCase({
      ...deps(),
      inviteRepository,
    });

    await useCase.execute({
      actorId: 1,
      actorRole: Role.MANAGER,
      scope: scopedManagerContext({
        territoryIds: [1],
        managedUserIds: [2],
      }),
    });

    expect(findAll).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      limit: 20,
      invitedByUserId: 1,
    });
  });
});
