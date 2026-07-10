import { db } from "../../../../../infrastructure/database/db";
import { territories, territoryClosure } from "@atlasmed/database";
import { eq, and, or, inArray } from "drizzle-orm";
import type { TerritoryClosureRepository } from "../../../application/interfaces/territory-closure.repository.interface";

export class PrismaTerritoryClosureRepository implements TerritoryClosureRepository {
  async deleteForDescendants(descendantIds: string[]): Promise<void> {
    if (descendantIds.length === 0) {
      return;
    }

    await db.delete(territoryClosure).where(inArray(territoryClosure.descendantId, descendantIds));
  }

  async insertRows(
    rows: Array<{ ancestorId: string; descendantId: string; depth: number }>
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await db.insert(territoryClosure).values(rows).onConflictDoNothing();
  }

  async findDescendantIds(ancestorIds: string[], activeOnly = true): Promise<string[]> {
    if (ancestorIds.length === 0) {
      return [];
    }

    if (activeOnly) {
      const rows = await db
        .select({ descendantId: territoryClosure.descendantId })
        .from(territoryClosure)
        .innerJoin(territories, eq(territoryClosure.descendantId, territories.id))
        .where(
          and(
            inArray(territoryClosure.ancestorId, ancestorIds),
            eq(territories.isActive, true)
          )
        );
      return [...new Set(rows.map((row) => row.descendantId))];
    }

    const rows = await db
      .select({ descendantId: territoryClosure.descendantId })
      .from(territoryClosure)
      .where(inArray(territoryClosure.ancestorId, ancestorIds));
    return [...new Set(rows.map((row) => row.descendantId))];
  }

  async findAncestorIds(descendantIds: string[]): Promise<string[]> {
    if (descendantIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({ ancestorId: territoryClosure.ancestorId })
      .from(territoryClosure)
      .where(inArray(territoryClosure.descendantId, descendantIds));

    return [...new Set(rows.map((row) => row.ancestorId))];
  }

  async hasAncestorDescendantRelation(
    territoryIdA: string,
    territoryIdB: string
  ): Promise<boolean> {
    if (territoryIdA === territoryIdB) {
      return true;
    }

    const rows = await db
      .select()
      .from(territoryClosure)
      .where(
        or(
          and(
            eq(territoryClosure.ancestorId, territoryIdA),
            eq(territoryClosure.descendantId, territoryIdB)
          ),
          and(
            eq(territoryClosure.ancestorId, territoryIdB),
            eq(territoryClosure.descendantId, territoryIdA)
          )
        )
      )
      .limit(1);

    return rows.length > 0;
  }
}
