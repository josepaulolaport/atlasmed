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
    managerId: string;
    sectorId: string;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:manage"],
        [`role:${params.actorRole}`],
      );
    }

    if (!params.sectorId) {
      throw new ValidationError([
        { field: "sectorId", message: "sectorId is required" },
      ]);
    }

    const manager = await this.deps.userRepository.findById(params.managerId);
    if (!manager) {
      throw new UserNotFoundError(params.managerId);
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
      (t) =>
        t.isActive &&
        t.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG &&
        (t.sectorId === null || t.sectorId === params.sectorId),
    );

    // findByIds may not include type slug — fall back to all assigned as potential zones
    const zoneIds =
      managerZones.length > 0
        ? managerZones.map((z) => z.id)
        : assignedTerritories
            .filter(
              (t) =>
                t.isActive &&
                (t.sectorId === null || t.sectorId === params.sectorId),
            )
            .map((t) => t.id);

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

    const inSector = patches.filter(
      (p) => p.isActive && p.sectorId === params.sectorId,
    );

    const territories = await Promise.all(
      inSector.map(async (p) => {
        const boundary =
          await this.deps.spatialRepository.getBoundaryAsGeoJson(p.id);
        return {
          id: p.id,
          name: p.name,
          sectorId: p.sectorId ?? params.sectorId,
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
          sectorId: zone.sectorId ?? params.sectorId,
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
