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
  sectorId?: string;
  sectorName?: string;
  boundary?: unknown;
}

export interface SectorAssignmentDto {
  sectorId: string;
  sectorName: string;
  managerId?: string;
  managerName?: string;
  territories: AssignmentTerritoryDto[];
}

export interface GetUserAssignmentsOutput {
  userId: string;
  isOperationallyActive: boolean;
  sectorAssignments: SectorAssignmentDto[];
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

    const [sectorRows, territoryRows, sectors] = await Promise.all([
      this.deps.scopeRepository.findSectorAssignmentsByUserId(
        params.targetUserId,
      ),
      this.deps.scopeRepository.findTerritoryAssignmentsByUserId(
        params.targetUserId,
      ),
      this.deps.scopeRepository.listActiveSectors(),
    ]);

    const sectorNameById = new Map(sectors.map((s) => [s.id, s.name]));
    const territoryIds = territoryRows.map((t) => t.territoryId);
    const territories =
      territoryIds.length > 0
        ? await this.deps.territoryRepository.findByIds(territoryIds)
        : [];
    const territoryById = new Map(territories.map((t) => [t.id, t]));

    const managerIds = [
      ...new Set(
        sectorRows
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

    const territoriesBySector = new Map<string, AssignmentTerritoryDto[]>();

    for (const row of territoryRows) {
      const territory = territoryById.get(row.territoryId);
      if (!territory) continue;
      const sectorId = territory.sectorId ?? "_unscoped";
      const boundary =
        await this.deps.spatialRepository.getBoundaryAsGeoJson(territory.id);
      const dto: AssignmentTerritoryDto = {
        id: territory.id,
        name: territory.name,
        ...(territory.sectorId
          ? {
              sectorId: territory.sectorId,
              sectorName: sectorNameById.get(territory.sectorId),
            }
          : {}),
        ...(boundary ? { boundary } : {}),
      };
      const list = territoriesBySector.get(sectorId) ?? [];
      list.push(dto);
      territoriesBySector.set(sectorId, list);
    }

    const sectorAssignments: SectorAssignmentDto[] = sectorRows.map((row) => {
      const managerId = row.managerId ?? undefined;
      return {
        sectorId: row.sectorId,
        sectorName: sectorNameById.get(row.sectorId) ?? "—",
        ...(managerId
          ? {
              managerId,
              managerName: managerNameById.get(managerId),
            }
          : {}),
        territories: territoriesBySector.get(row.sectorId) ?? [],
      };
    });

    // Territories whose sector was not in sectorRows still surface under a synthetic row.
    for (const [sectorId, list] of territoriesBySector) {
      if (sectorId === "_unscoped") continue;
      if (sectorAssignments.some((s) => s.sectorId === sectorId)) continue;
      sectorAssignments.push({
        sectorId,
        sectorName: sectorNameById.get(sectorId) ?? "—",
        territories: list,
      });
    }

    const roleName = user.role?.name ?? Role.REP;
    const isOperationallyActive =
      roleName === Role.REP && territoryRows.length > 0;

    return {
      userId: params.targetUserId,
      isOperationallyActive,
      sectorAssignments,
    };
  }
}
