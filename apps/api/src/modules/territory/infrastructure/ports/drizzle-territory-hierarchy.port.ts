import { db } from "../../../../infrastructure/database/db";
import { userTerritoryAssignments } from "@atlasmed/database";
import { inArray } from "drizzle-orm";
import type { TerritoryHierarchyPort } from "../../application/interfaces/territory-hierarchy.port.interface";
import type { TerritoryRepository } from "../../application/interfaces/territory.repository.interface";
import { MANAGER_ZONE_TYPE_SLUG } from "../../application/constants/territory-roles.constants";

export class DrizzleTerritoryHierarchyPort implements TerritoryHierarchyPort {
  constructor(private readonly territoryRepository: TerritoryRepository) {}

  async resolveEffectiveTerritoryIds(
    assignedTerritoryIds: number[],
    activeOnly = true
  ): Promise<number[]> {
    if (assignedTerritoryIds.length === 0) {
      return [];
    }

    const assignedTerritories = await this.territoryRepository.findByIds(
      assignedTerritoryIds
    );

    const effective = new Set<number>();
    const managerZoneIds: number[] = [];

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

  /**
   * Users assigned directly to any of the given territories, or to the
   * manager zone that owns one of them (so a manager zone change also
   * invalidates the scope cache of reps assigned to its rep patches).
   */
  async findUsersAssignedToRelatedTerritories(territoryIds: number[]): Promise<number[]> {
    if (territoryIds.length === 0) {
      return [];
    }

    const territories = await this.territoryRepository.findByIds(territoryIds);
    const relatedTerritoryIds = new Set<number>(territoryIds);

    for (const territory of territories) {
      if (territory.managerTerritoryId) {
        relatedTerritoryIds.add(territory.managerTerritoryId);
      }
    }

    const assignments = await db
      .select({ userId: userTerritoryAssignments.userId })
      .from(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.territoryId, [...relatedTerritoryIds]));

    return [...new Set(assignments.map((a) => a.userId))];
  }
}
