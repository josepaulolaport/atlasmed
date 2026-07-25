import { Role } from "@atlasmed/access";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritorySpatialRepository } from "../../../territory/application/interfaces/territory-spatial.repository.interface";
import {
  InsufficientPermissionsError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { serializeInvitation } from "../utils/serialize-invitation.utils";

interface Dependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryRepository;
  spatialRepository: TerritorySpatialRepository;
}

export class GetInvitationByIdUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { inviteId: string; actorRole: Role }) {
    if (params.actorRole === Role.REP) {
      throw new InsufficientPermissionsError(
        ["invitation:read"],
        [`role:${params.actorRole}`],
      );
    }

    const invite = await this.deps.inviteRepository.findById(params.inviteId);
    if (!invite) {
      throw new ResourceNotFoundError("Invitation", params.inviteId);
    }

    const [inviter, staged, verticals] = await Promise.all([
      this.deps.userRepository.findById(invite.invitedByUserId),
      this.deps.inviteRepository.findStagedVerticalAssignments([invite.id]),
      this.deps.scopeRepository.listActiveVerticals(),
    ]);

    const verticalNameById = new Map(verticals.map((v) => [v.id, v.name]));
    const territoryIds = [...new Set(staged.flatMap((s) => s.territoryIds))];
    const territories =
      territoryIds.length > 0
        ? await this.deps.territoryRepository.findByIds(territoryIds)
        : [];
    const territoryById = new Map(territories.map((t) => [t.id, t]));

    const managerIds = [
      ...new Set(
        staged
          .map((s) => s.managerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const managers = await Promise.all(
      managerIds.map((id) => this.deps.userRepository.findById(id)),
    );
    const managerNameById = new Map(
      managers
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => {
          const name = [m.firstName, m.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          return [m.id, name || m.username] as const;
        }),
    );

    const verticalAssignments = await Promise.all(
      staged.map(async (row) => {
        const territoriesDto = await Promise.all(
          row.territoryIds.map(async (id) => {
            const t = territoryById.get(id);
            const boundary = t
              ? await this.deps.spatialRepository.getBoundaryAsGeoJson(id)
              : null;
            return {
              id,
              name: t?.name ?? id,
              verticalId: row.verticalId,
              verticalName: verticalNameById.get(row.verticalId),
              ...(boundary ? { boundary } : {}),
            };
          }),
        );

        return {
          verticalId: row.verticalId,
          verticalName: verticalNameById.get(row.verticalId) ?? "—",
          managerId: row.managerId,
          managerName: row.managerId
            ? managerNameById.get(row.managerId)
            : undefined,
          territories: territoriesDto,
        };
      }),
    );

    return serializeInvitation({
      invite,
      invitedBy: inviter,
      verticalAssignments,
    });
  }
}
