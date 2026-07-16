import { facilities, interactions } from "@atlasmed/database";
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import type { InteractionRecord, InteractionRepository } from "../../../application/interfaces/interaction.repository.interface";

function facilityScopeCondition(facilityIds?: string[]) {
  if (facilityIds === undefined) return undefined;
  return inArray(facilities.id, facilityIds.length ? facilityIds : ["__none__"]);
}

export class DrizzleInteractionRepository implements InteractionRepository {
  async create(input: {
    type: "followup" | "presentation";
    summary: string;
    userId: string;
    facilityId: string;
    interactedAt: Date;
  }): Promise<InteractionRecord> {
    const [interaction] = await db.insert(interactions).values(input).returning();
    if (!interaction) {
      throw new DatabaseError("create interaction");
    }
    return interaction;
  }

  async countDistinctFacilitiesForUserInPeriod(input: {
    userId: string;
    start: Date;
    end: Date;
    facilityIds?: string[];
  }): Promise<number> {
    const scope = facilityScopeCondition(input.facilityIds);
    const conditions = [
      eq(interactions.userId, input.userId),
      gte(interactions.interactedAt, input.start),
      lt(interactions.interactedAt, input.end),
    ];
    if (scope) conditions.push(scope);
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${interactions.facilityId})::int` })
      .from(interactions)
      .innerJoin(facilities, eq(facilities.id, interactions.facilityId))
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  async countFacilities(input: { facilityIds?: string[] }): Promise<number> {
    const scope = facilityScopeCondition(input.facilityIds);
    const conditions = [isNull(facilities.deactivatedAt)];
    if (scope) conditions.push(scope);
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(facilities).where(and(...conditions));
    return row?.count ?? 0;
  }
}
