import { facilities, visits } from "@atlasmed/database";
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import type { VisitRecord, VisitRepository } from "../../../application/interfaces/visit.repository.interface";

function facilityScopeCondition(facilityIds?: string[]) {
  if (facilityIds === undefined) return undefined;
  return inArray(facilities.id, facilityIds.length ? facilityIds : ["__none__"]);
}

export class DrizzleVisitRepository implements VisitRepository {
  async create(input: { userId: string; facilityId: string; visitedAt: Date }): Promise<VisitRecord> {
    const [visit] = await db.insert(visits).values(input).returning();
    if (!visit) {
      throw new DatabaseError("create visit");
    }
    return visit;
  }

  async countDistinctFacilitiesForUserInPeriod(input: {
    userId: string;
    start: Date;
    end: Date;
    facilityIds?: string[];
  }): Promise<number> {
    const scope = facilityScopeCondition(input.facilityIds);
    const conditions = [
      eq(visits.userId, input.userId),
      gte(visits.visitedAt, input.start),
      lt(visits.visitedAt, input.end),
    ];
    if (scope) conditions.push(scope);
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${visits.facilityId})::int` })
      .from(visits)
      .innerJoin(facilities, eq(facilities.id, visits.facilityId))
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
