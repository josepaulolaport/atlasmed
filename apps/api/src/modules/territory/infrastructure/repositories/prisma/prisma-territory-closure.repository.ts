import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type { TerritoryClosureRepository } from "../../../application/interfaces/territory-closure.repository.interface";

export class PrismaTerritoryClosureRepository implements TerritoryClosureRepository {
  async deleteForDescendants(descendantIds: string[]): Promise<void> {
    if (descendantIds.length === 0) {
      return;
    }

    await prisma.territoryClosure.deleteMany({
      where: { descendantId: { in: descendantIds } },
    });
  }

  async insertRows(
    rows: Array<{ ancestorId: string; descendantId: string; depth: number }>
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await prisma.territoryClosure.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  async findDescendantIds(ancestorIds: string[], activeOnly = true): Promise<string[]> {
    if (ancestorIds.length === 0) {
      return [];
    }

    const rows = await prisma.territoryClosure.findMany({
      where: {
        ancestorId: { in: ancestorIds },
        ...(activeOnly
          ? { descendant: { isActive: true } }
          : {}),
      },
      select: { descendantId: true },
    });

    return [...new Set(rows.map((row) => row.descendantId))];
  }

  async findAncestorIds(descendantIds: string[]): Promise<string[]> {
    if (descendantIds.length === 0) {
      return [];
    }

    const rows = await prisma.territoryClosure.findMany({
      where: { descendantId: { in: descendantIds } },
      select: { ancestorId: true },
    });

    return [...new Set(rows.map((row) => row.ancestorId))];
  }

  async hasAncestorDescendantRelation(
    territoryIdA: string,
    territoryIdB: string
  ): Promise<boolean> {
    if (territoryIdA === territoryIdB) {
      return true;
    }

    const row = await prisma.territoryClosure.findFirst({
      where: {
        OR: [
          { ancestorId: territoryIdA, descendantId: territoryIdB },
          { ancestorId: territoryIdB, descendantId: territoryIdA },
        ],
      },
    });

    return row !== null;
  }
}
