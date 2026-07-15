import { visits, type Database } from "@atlasmed/database";
import { eq, desc, sql } from "drizzle-orm";
import { db as defaultDb } from "../../../../../infrastructure/database/db";

export interface VisitRecord {
  id: string;
  userId: string;
  facilityId: string;
  visitedAt: Date;
  createdAt: Date;
}

export type CreateVisitInput = {
  userId: string;
  facilityId: string;
  visitedAt: Date;
};

export class DrizzleVisitRepository {
  constructor(private readonly db: Database = defaultDb) {}

  async findByFacilityAndUser(
    facilityId: string,
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<VisitRecord[]> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(visits)
      .where(
        eq(visits.facilityId, facilityId) &&
        eq(visits.userId, userId),
      )
      .orderBy(desc(visits.visitedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      facilityId: row.facilityId,
      visitedAt: row.visitedAt,
      createdAt: row.createdAt,
    }));
  }

  async countByFacilityAndUser(
    facilityId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(visits)
      .where(
        eq(visits.facilityId, facilityId) &&
        eq(visits.userId, userId),
      );

    return Number(result[0]?.count ?? 0);
  }

  async create(input: CreateVisitInput): Promise<VisitRecord> {
    const rows = await this.db
      .insert(visits)
      .values({
        userId: input.userId,
        facilityId: input.facilityId,
        visitedAt: input.visitedAt,
      })
      .returning();

    const row = rows[0]!;
    return {
      id: row.id,
      userId: row.userId,
      facilityId: row.facilityId,
      visitedAt: row.visitedAt,
      createdAt: row.createdAt,
    };
  }
}
