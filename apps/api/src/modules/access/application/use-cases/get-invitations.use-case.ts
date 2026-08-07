import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { Role, ScopeContext } from "@atlasmed/access";
import { InsufficientPermissionsError } from "../../../../shared/errors";
import {
  groupStagedAssignments,
  serializeInvitation,
} from "../utils/serialize-invitation.utils";

interface GetInvitationsInput {
  status?: string;
  page?: number;
  limit?: number;
  actorId: number;
  actorRole: Role;
  scope: ScopeContext;
}

interface GetInvitationsDependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryRepository;
}

export class GetInvitationsUseCase {
  constructor(private readonly dependencies: GetInvitationsDependencies) {}

  async execute(input: GetInvitationsInput) {
    if (input.actorRole === "REP") {
      throw new InsufficientPermissionsError(
        ["invitation:list"],
        [`role:${input.actorRole}`],
      );
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const listParams: {
      status?: string;
      page: number;
      limit: number;
      invitedByUserId?: number;
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

    const inviteIds = invitations.map((invite) => invite.id);
    const [inviters, staged, verticals] = await Promise.all([
      Promise.all(
        [...new Set(invitations.map((i) => i.invitedByUserId))].map((id) =>
          this.dependencies.userRepository.findById(id),
        ),
      ),
      this.dependencies.inviteRepository.findStagedVerticalAssignments(inviteIds),
      this.dependencies.scopeRepository.listActiveVerticals(),
    ]);

    const inviterMap = new Map(
      inviters
        .filter((inviter) => inviter !== null)
        .map((inviter) => [inviter!.id, inviter!]),
    );
    const verticalNameById = new Map(verticals.map((v) => [v.id, v.name]));
    const stagedByInvite = groupStagedAssignments(staged);

    const territoryIds = [...new Set(staged.flatMap((s) => s.territoryIds))];
    const territories =
      territoryIds.length > 0
        ? await this.dependencies.territoryRepository.findByIds(territoryIds)
        : [];
    const territoryById = new Map(territories.map((t) => [t.id, t]));

    return {
      invitations: invitations.map((invite) => {
        const stagedRows = stagedByInvite.get(invite.id) ?? [];
        const verticalAssignments = stagedRows.map((row) => ({
          verticalId: row.verticalId,
          verticalName: verticalNameById.get(row.verticalId) ?? "—",
          territories: row.territoryIds.map((id) => {
            const t = territoryById.get(id);
            return {
              id,
              name: t?.name ?? String(id),
              verticalId: row.verticalId,
              verticalName: verticalNameById.get(row.verticalId),
            };
          }),
        }));

        return serializeInvitation({
          invite,
          invitedBy: inviterMap.get(invite.invitedByUserId) ?? null,
          verticalAssignments,
        });
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
