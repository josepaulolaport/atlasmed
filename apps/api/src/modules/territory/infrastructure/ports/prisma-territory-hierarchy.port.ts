import { prisma } from "../../../../infrastructure/database/prisma.client";
import type { TerritoryHierarchyPort } from "../../application/interfaces/territory-hierarchy.port.interface";
import type { TerritoryClosureRepository } from "../../application/interfaces/territory-closure.repository.interface";

export class PrismaTerritoryHierarchyPort implements TerritoryHierarchyPort {
  constructor(private readonly closureRepository: TerritoryClosureRepository) {}

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

    const ancestorIds = await this.closureRepository.findAncestorIds(territoryIds);

    const assignments = await prisma.userTerritoryAssignment.findMany({
      where: {
        territoryId: { in: [...territoryIds, ...ancestorIds] },
      },
      select: { userId: true },
    });

    return [...new Set(assignments.map((assignment) => assignment.userId))];
  }
}
