import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritorySpatialRepository } from "../../../territory/application/interfaces/territory-spatial.repository.interface";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";

interface GetUserAssignmentsDependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryRepository;
  spatialRepository: TerritorySpatialRepository;
}

export interface AssignmentTerritoryDto {
  id: string;
  name: string;
  boundary?: unknown;
}

export interface VerticalAssignmentDto {
  verticalId: string;
  verticalName: string;
  managerId?: string;
  managerName?: string;
  territories: AssignmentTerritoryDto[];
}

export interface GetUserAssignmentsOutput {
  userId: string;
  isOperationallyActive: boolean;
  verticalAssignments: VerticalAssignmentDto[];
}

export class GetUserAssignmentsUseCase {
  constructor(private readonly deps: GetUserAssignmentsDependencies) {}

  async execute(params: {
    targetUserId: string;
    actorRole: Role;
    self?: boolean;
  }): Promise<GetUserAssignmentsOutput> {
    if (!params.self && params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:read_assignments"],
        [`role:${params.actorRole}`],
      );
    }

    const user = await this.deps.userRepository.findById(params.targetUserId);

    if (!user) {
      throw new UserNotFoundError(params.targetUserId);
    }

    const [verticalRows, territoryRows, verticals] = await Promise.all([
      this.deps.scopeRepository.findVerticalAssignmentsByUserId(
        params.targetUserId,
      ),
      this.deps.scopeRepository.findTerritoryAssignmentsByUserId(
        params.targetUserId,
      ),
      this.deps.scopeRepository.listActiveVerticals(),
    ]);

    const verticalNameById = new Map(verticals.map((v) => [v.id, v.name]));
    const territoryIds = territoryRows.map((t) => t.territoryId);
    const territories =
      territoryIds.length > 0
        ? await this.deps.territoryRepository.findByIds(territoryIds)
        : [];
    const territoryById = new Map(territories.map((t) => [t.id, t]));

    const managerIds = [
      ...new Set(
        verticalRows
          .map((v) => v.managerId)
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

    const territoryDtos: AssignmentTerritoryDto[] = [];
    for (const row of territoryRows) {
      const territory = territoryById.get(row.territoryId);
      if (!territory) continue;
      const boundary =
        await this.deps.spatialRepository.getBoundaryAsGeoJson(territory.id);
      territoryDtos.push({
        id: territory.id,
        name: territory.name,
        ...(boundary ? { boundary } : {}),
      });
    }

    const verticalAssignments: VerticalAssignmentDto[] = verticalRows.map((row) => {
      const managerId = row.managerId ?? undefined;
      return {
        verticalId: row.verticalId,
        verticalName: verticalNameById.get(row.verticalId) ?? "—",
        ...(managerId
          ? {
              managerId,
              managerName: managerNameById.get(managerId),
            }
          : {}),
        territories:
          verticalRows.length === 1 ? territoryDtos : [],
      };
    });

    if (verticalRows.length > 1 && territoryDtos.length > 0 && verticalAssignments[0]) {
      verticalAssignments[0].territories = territoryDtos;
    }

    const roleName = user.role?.name ?? Role.REP;
    const isOperationallyActive =
      roleName === Role.REP && territoryRows.length > 0;

    return {
      userId: params.targetUserId,
      isOperationallyActive,
      verticalAssignments,
    };
  }
}
