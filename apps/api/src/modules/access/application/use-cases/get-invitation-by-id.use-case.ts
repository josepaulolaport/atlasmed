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
import { MANAGER_ZONE_TYPE_SLUG } from "../../../territory/application/constants/territory-roles.constants";

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

        const managerName = await this.resolveManagerNameForTerritories(
          row.territoryIds.map((id) => territoryById.get(id)).filter(Boolean),
        );

        return {
          verticalId: row.verticalId,
          verticalName: verticalNameById.get(row.verticalId) ?? "—",
          ...(managerName ? { managerName } : {}),
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

  private async resolveManagerNameForTerritories(
    territories: Array<{
      id: string;
      managerTerritoryId: string | null;
      territoryType?: { slug: string } | null;
    } | undefined>,
  ): Promise<string | undefined> {
    const zoneIds = new Set<string>();
    for (const t of territories) {
      if (!t) continue;
      if (t.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG) {
        zoneIds.add(t.id);
      } else if (t.managerTerritoryId) {
        zoneIds.add(t.managerTerritoryId);
      }
    }
    if (zoneIds.size === 0) return undefined;

    for (const zoneId of zoneIds) {
      const assignees =
        await this.deps.scopeRepository.findUserIdsByTerritoryId(zoneId);
      if (assignees.length === 0) continue;
      const user = await this.deps.userRepository.findById(assignees[0]!.userId);
      if (!user) continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      return name || user.username;
    }
    return undefined;
  }
}
