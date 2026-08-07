import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritorySpatialRepository } from "../../../territory/application/interfaces/territory-spatial.repository.interface";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";
import { MANAGER_ZONE_TYPE_SLUG } from "../../../territory/application/constants/territory-roles.constants";

interface GetUserAssignmentsDependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryRepository;
  spatialRepository: TerritorySpatialRepository;
}

export interface AssignmentTerritoryDto {
  id: string;
  name: string;
  managerZoneId?: string;
  managerZoneName?: string;
  boundary?: unknown;
}

export interface AssignmentManagerDto {
  id: string;
  name: string;
}

export interface VerticalAssignmentDto {
  verticalId: string;
  verticalName: string;
  /** Distinct managers via zone UTAs covering this vertical's territories. */
  managers: AssignmentManagerDto[];
  /** Compat summary — joined manager names (multi-manager safe). */
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

    const zoneIds = new Set<string>();
    for (const t of territories) {
      if (t.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG) {
        zoneIds.add(t.id);
      } else if (t.managerTerritoryId) {
        zoneIds.add(t.managerTerritoryId);
      }
    }

    const zoneById = new Map<string, { id: string; name: string }>();
    if (zoneIds.size > 0) {
      const zones = await this.deps.territoryRepository.findByIds([
        ...zoneIds,
      ]);
      for (const z of zones) {
        zoneById.set(z.id, { id: z.id, name: z.name });
      }
    }

    const managersByZoneId = new Map<string, AssignmentManagerDto[]>();
    for (const zoneId of zoneIds) {
      const assignees =
        await this.deps.scopeRepository.findUserIdsByTerritoryId(zoneId);
      const managers: AssignmentManagerDto[] = [];
      for (const row of assignees) {
        const mgr = await this.deps.userRepository.findById(row.userId);
        if (!mgr || mgr.role.name !== Role.MANAGER) continue;
        const name =
          [mgr.firstName, mgr.lastName].filter(Boolean).join(" ").trim() ||
          mgr.username;
        managers.push({ id: mgr.id, name });
      }
      managersByZoneId.set(zoneId, managers);
    }

    const territoriesByVertical = new Map<string, AssignmentTerritoryDto[]>();
    for (const row of territoryRows) {
      const territory = territoryById.get(row.territoryId);
      if (!territory) continue;
      const boundary =
        await this.deps.spatialRepository.getBoundaryAsGeoJson(territory.id);
      const zoneId =
        territory.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG
          ? territory.id
          : territory.managerTerritoryId ?? undefined;
      const zone = zoneId ? zoneById.get(zoneId) : undefined;
      const dto: AssignmentTerritoryDto = {
        id: territory.id,
        name: territory.name,
        ...(zone
          ? { managerZoneId: zone.id, managerZoneName: zone.name }
          : {}),
        ...(boundary ? { boundary } : {}),
      };
      const list = territoriesByVertical.get(territory.verticalId) ?? [];
      list.push(dto);
      territoriesByVertical.set(territory.verticalId, list);
    }

    // UVAs are source of truth; also surface verticals that only appear via
    // territory UTAs (legacy accepts / partial backfills) so Desempenho/map work.
    const verticalIds = new Set<string>([
      ...verticalRows.map((row) => row.verticalId),
      ...territoriesByVertical.keys(),
    ]);

    const verticalAssignments: VerticalAssignmentDto[] = [...verticalIds].map(
      (verticalId) => {
        const territoriesForVertical =
          territoriesByVertical.get(verticalId) ?? [];
        const managerMap = new Map<string, AssignmentManagerDto>();
        for (const t of territoriesForVertical) {
          if (!t.managerZoneId) continue;
          for (const m of managersByZoneId.get(t.managerZoneId) ?? []) {
            managerMap.set(m.id, m);
          }
        }
        const managers = [...managerMap.values()];
        const managerName =
          managers.length > 0
            ? managers.map((m) => m.name).join(", ")
            : undefined;
        return {
          verticalId,
          verticalName: verticalNameById.get(verticalId) ?? "—",
          managers,
          ...(managerName ? { managerName } : {}),
          territories: territoriesForVertical,
        };
      },
    );

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
