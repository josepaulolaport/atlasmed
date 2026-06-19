import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { Role, ScopeContext } from "@atlasmed/access";
import { InsufficientPermissionsError } from "../../../../shared/errors";

interface GetInvitationsInput {
  status?: string;
  page?: number;
  limit?: number;
  actorId: string;
  actorRole: Role;
  scope: ScopeContext;
}

interface GetInvitationsDependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
}

export class GetInvitationsUseCase {
  constructor(private readonly dependencies: GetInvitationsDependencies) {}

  async execute(input: GetInvitationsInput) {
    if (input.actorRole === "USER") {
      throw new InsufficientPermissionsError(
        ["invitation:list"],
        [`role:${input.actorRole}`]
      );
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const listParams: {
      status?: string;
      page: number;
      limit: number;
      invitedByUserId?: string;
    } = {
      status: input.status,
      page,
      limit,
    };

    if (!input.scope.isGlobal && input.actorRole === "MANAGER") {
      listParams.invitedByUserId = input.actorId;
    }

    const { invitations, total } =
      await this.dependencies.inviteRepository.findAll(listParams);

    const inviterIds = [
      ...new Set(invitations.map((invite) => invite.invitedByUserId)),
    ];

    const inviters = await Promise.all(
      inviterIds.map((id) => this.dependencies.userRepository.findById(id))
    );

    const inviterMap = new Map(
      inviters
        .filter((inviter) => inviter !== null)
        .map((inviter) => [inviter!.id, inviter!])
    );

    return {
      invitations: invitations.map((invite) => {
        const inviter = inviterMap.get(invite.invitedByUserId);

        return {
          id: invite.id,
          email: invite.email ?? undefined,
          phoneNumber: invite.phoneNumber ?? undefined,
          status: invite.status,
          role: {
            id: invite.role.id,
            name: invite.role.name,
          },
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
          acceptedAt: invite.acceptedAt?.toISOString() ?? undefined,
          revokedAt: invite.revokedAt?.toISOString() ?? undefined,
          invitedBy: inviter
            ? {
                id: inviter.id,
                username: inviter.username,
                email: inviter.email,
                firstName: inviter.firstName ?? undefined,
                lastName: inviter.lastName ?? undefined,
              }
            : {
                id: invite.invitedByUserId,
                username: "Unknown",
                email: "",
              },
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
