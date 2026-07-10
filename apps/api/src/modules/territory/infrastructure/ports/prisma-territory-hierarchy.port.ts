import { db } from "../../../../infrastructure/database/db";
import { userTerritoryAssignments } from "@atlasmed/database";
import { inArray } from "drizzle-orm";
import type { TerritoryHierarchyPort } from "../../application/interfaces/territory-hierarchy.port.interface";
import type { TerritoryClosureRepository } from "../../application/interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../../application/interfaces/territory.repository.interface";
import { MANAGER_ZONE_TYPE_SLUG } from "../../application/constants/territory-roles.constants";

export class PrismaTerritoryHierarchyPort implements TerritoryHierarchyPort {
  constructor(
    private readonly closureRepository: TerritoryClosureRepository,
    private readonly territoryRepository: TerritoryRepository
  ) {}

  async resolveEffectiveTerritoryIds(
    assignedTerritoryIds: string[],
    activeOnly = true
  ): Promise<string[]> {
    if (assignedTerritoryIds.length === 0) {
      return [];
    }

    const assignedTerritories = await this.territoryRepository.findByIds(
      assignedTerritoryIds
    );

    const effective = new Set<string>();
    const managerZoneIds: string[] = [];

    for (const territory of assignedTerritories) {
      if (!territory.isActive && activeOnly) {
        continue;
      }

      effective.add(territory.id);

      if (territory.territoryType?.slug === MANAGER_ZONE_TYPE_SLUG) {
        managerZoneIds.push(territory.id);
      }
    }

    if (managerZoneIds.length > 0) {
      const patchIds =
        await this.territoryRepository.findRepPatchIdsByManagerTerritoryIds(managerZoneIds);
      for (const patchId of patchIds) {
        effective.add(patchId);
      }
    }

    return [...effective];
  }

  async resolveDescendantIds(
    ancestorIds: string[],
    activeOnly = true
  ): Promise<string[]> {
    if (ancestorIds.length === 0) {
      return [];
    }

    const descendants = await this.closureRepository.findDescendantIds(
      ancestorIds,
      activeOnly
    );

    return [...new Set([...ancestorIds, ...descendants])];
  }

  async findUsersAssignedToTerritoryAncestors(territoryIds: string[]): Promise<string[]> {
    if (territoryIds.length === 0) {
      return [];
    }

    const territories = await this.territoryRepository.findByIds(territoryIds);
    const relatedTerritoryIds = new Set<string>(territoryIds);

    for (const territory of territories) {
      if (territory.managerTerritoryId) {
        relatedTerritoryIds.add(territory.managerTerritoryId);
      }
    }

    const ancestorIds = await this.closureRepository.findAncestorIds(territoryIds);
    for (const ancestorId of ancestorIds) {
      relatedTerritoryIds.add(ancestorId);
    }

    const assignments = await db
      .select({ userId: userTerritoryAssignments.userId })
      .from(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.territoryId, [...relatedTerritoryIds]));

    return [...new Set(assignments.map((a) => a.userId))];
  }
}
