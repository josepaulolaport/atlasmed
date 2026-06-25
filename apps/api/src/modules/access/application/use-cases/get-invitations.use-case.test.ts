import { describe, expect, it, mock } from "bun:test";
import { GetInvitationsUseCase } from "./get-invitations.use-case";
import { createMockInviteRepository, createMockUserRepository } from "../../test-helpers/repository-mocks";
import { createGlobalScopeContext, Role } from "@atlasmed/access";
import { scopedManagerContext } from "../../test-helpers/route-test-context";
import { InsufficientPermissionsError } from "../../../../shared/errors";

describe("GetInvitationsUseCase", () => {
  const mockInvite = {
    id: "invite-1",
    email: "new@example.com",
    phoneNumber: null,
    status: "PENDING",
    expiresAt: new Date("2025-12-31"),
    createdAt: new Date("2025-01-01"),
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: "manager-1",
    role: { id: "role-1", name: "USER" },
  };

  it("should reject USER role", async () => {
    const useCase = new GetInvitationsUseCase({
      inviteRepository: createMockInviteRepository(),
      userRepository: createMockUserRepository(),
    });

    await expect(
      useCase.execute({
        actorId: "user-1",
        actorRole: Role.USER,
        scope: createGlobalScopeContext(),
      })
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it("should list all invitations for global admin scope", async () => {
    const findAll = mock(() =>
      Promise.resolve({ invitations: [mockInvite], total: 1 })
    );
    const inviteRepository = createMockInviteRepository({ findAll });
    const userRepository = createMockUserRepository({
      findById: mock(() =>
        Promise.resolve({
          id: "manager-1",
          username: "mgr",
          email: "mgr@example.com",
          firstName: "M",
          lastName: "G",
        })
      ),
    });

    const useCase = new GetInvitationsUseCase({ inviteRepository, userRepository });
    await useCase.execute({
      actorId: "admin-1",
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
      inviteRepository,
      userRepository: createMockUserRepository(),
    });

    await useCase.execute({
      actorId: "manager-1",
      actorRole: Role.MANAGER,
      scope: scopedManagerContext({
        territoryIds: ["t-1"],
        managedUserIds: ["u-1"],
      }),
    });

    expect(findAll).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      limit: 20,
      invitedByUserId: "manager-1",
    });
  });
});
