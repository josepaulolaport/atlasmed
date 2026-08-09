import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritorySpatialRepository } from "../../../territory/application/interfaces/territory-spatial.repository.interface";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { MANAGER_ZONE_TYPE_SLUG } from "../../../territory/application/constants/territory-roles.constants";

interface Dependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryRepository;
  spatialRepository: TerritorySpatialRepository;
}

export class GetAssignableTerritoriesForManagerUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    managerId: number;
    verticalId: number;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:manage"],
        [`role:${params.actorRole}`],
      );
    }

    if (!params.verticalId) {
      throw new ValidationError([
        { field: "verticalId", message: "verticalId is required" },
      ]);
    }

    const manager = await this.deps.userRepository.findById(params.managerId);
    if (!manager) {
      throw new UserNotFoundError(params.managerId);
    }

    const assignedVerticalIds =
      await this.deps.scopeRepository.findVerticalIdsByUserId(params.managerId);
    if (!assignedVerticalIds.includes(params.verticalId)) {
      return { territories: [], managerZones: [] };
    }

    const assigned = await this.deps.scopeRepository.findTerritoryAssignmentsByUserId(
      params.managerId,
    );
    const assignedIds = assigned.map((a) => a.territoryId);
    if (assignedIds.length === 0) {
      return { territories: [], managerZones: [] };
    }

    const assignedTerritories =
      await this.deps.territoryRepository.findByIds(assignedIds);
    const managerZones = assignedTerritories.filter(
      (t) => t.isActive && t.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG,
    );

    const zoneIds =
      managerZones.length > 0
        ? managerZones.map((z) => z.id)
        : assignedTerritories.filter((t) => t.isActive).map((t) => t.id);

    if (zoneIds.length === 0) {
      return { territories: [], managerZones: [] };
    }

    const patchIds =
      await this.deps.territoryRepository.findRepPatchIdsByManagerTerritoryIds(
        zoneIds,
      );
    const patches =
      patchIds.length > 0
        ? await this.deps.territoryRepository.findByIds(patchIds)
        : [];

    const activePatches = patches.filter((p) => p.isActive);

    const territories = await Promise.all(
      activePatches.map(async (p) => {
        const boundary =
          await this.deps.spatialRepository.getBoundaryAsGeoJson(p.id);
        return {
          id: p.id,
          name: p.name,
          verticalId: params.verticalId,
          managerTerritoryId: p.managerTerritoryId ?? undefined,
          ...(boundary ? { boundary } : {}),
        };
      }),
    );

    const managerZoneDtos = await Promise.all(
      zoneIds.map(async (id) => {
        const zone =
          assignedTerritories.find((t) => t.id === id) ??
          (await this.deps.territoryRepository.findById(id));
        if (!zone) return null;
        const boundary =
          await this.deps.spatialRepository.getBoundaryAsGeoJson(zone.id);
        return {
          id: zone.id,
          name: zone.name,
          verticalId: params.verticalId,
          ...(boundary ? { boundary } : {}),
        };
      }),
    );

    return {
      territories,
      managerZones: managerZoneDtos.filter(Boolean),
    };
  }
}
