import { interactions, users, type Database } from "@atlasmed/database";
import { eq, desc, sql } from "drizzle-orm";
import { db as defaultDb } from "../../../../../infrastructure/database/db";

export interface InteractionWithAgent {
  id: string;
  type: "followup" | "presentation";
  summary: string;
  userId: string;
  agentName: string;
  facilityId: string;
  interactedAt: Date;
  createdAt: Date;
}

export type CreateInteractionInput = {
  type: "followup" | "presentation";
  summary: string;
  userId: string;
  facilityId: string;
  interactedAt: Date;
};

export class DrizzleFacilityInteractionRepository {
  constructor(private readonly db: Database = defaultDb) {}

  async findByFacility(
    facilityId: string,
    options?: { page?: number; limit?: number },
  ): Promise<InteractionWithAgent[]> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select({
        id: interactions.id,
        type: interactions.type,
        summary: interactions.summary,
        userId: interactions.userId,
        agentName: sql<string>`COALESCE(NULLIF(TRIM(${users.firstName} || ' ' || ${users.lastName}), ''), ${users.username})`,
        facilityId: interactions.facilityId,
        interactedAt: interactions.interactedAt,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .innerJoin(users, eq(users.id, interactions.userId))
      .where(eq(interactions.facilityId, facilityId))
      .orderBy(desc(interactions.interactedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      summary: row.summary,
      userId: row.userId,
      agentName: row.agentName,
      facilityId: row.facilityId,
      interactedAt: row.interactedAt,
      createdAt: row.createdAt,
    }));
  }

  async countByFacility(facilityId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(interactions)
      .where(eq(interactions.facilityId, facilityId));

    return Number(result[0]?.count ?? 0);
  }

  async create(input: CreateInteractionInput): Promise<InteractionWithAgent> {
    const rows = await this.db
      .insert(interactions)
      .values({
        type: input.type,
        summary: input.summary,
        userId: input.userId,
        facilityId: input.facilityId,
        interactedAt: input.interactedAt,
      })
      .returning();

    const row = rows[0]!;

    // Fetch agent name
    const [user] = await this.db
      .select({
        agentName: sql<string>`COALESCE(NULLIF(TRIM(${users.firstName} || ' ' || ${users.lastName}), ''), ${users.username})`,
      })
      .from(users)
      .where(eq(users.id, row.userId));

    return {
      id: row.id,
      type: row.type,
      summary: row.summary,
      userId: row.userId,
      agentName: user?.agentName ?? "",
      facilityId: row.facilityId,
      interactedAt: row.interactedAt,
      createdAt: row.createdAt,
    };
  }

  /** Get the most recent interaction for each facility in a list. */
  async findLatestByFacilityIds(facilityIds: string[]): Promise<Map<string, InteractionWithAgent>> {
    if (facilityIds.length === 0) return new Map();

    // Subquery: latest interactedAt per facility
    const latestIds = this.db
      .select({
        facilityId: interactions.facilityId,
        maxInteractedAt: sql<Date>`max(${interactions.interactedAt})`.as("max_interacted_at"),
      })
      .from(interactions)
      .where(sql`${interactions.facilityId} IN (${sql.join(facilityIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(interactions.facilityId)
      .as("latest");

    const rows = await this.db
      .select({
        id: interactions.id,
        type: interactions.type,
        summary: interactions.summary,
        userId: interactions.userId,
        agentName: sql<string>`COALESCE(NULLIF(TRIM(${users.firstName} || ' ' || ${users.lastName}), ''), ${users.username})`,
        facilityId: interactions.facilityId,
        interactedAt: interactions.interactedAt,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .innerJoin(users, eq(users.id, interactions.userId))
      .innerJoin(
        latestIds,
        sql`${interactions.facilityId} = ${latestIds.facilityId} AND ${interactions.interactedAt} = ${latestIds.maxInteractedAt}`
      );

    const map = new Map<string, InteractionWithAgent>();
    for (const row of rows) {
      map.set(row.facilityId, {
        id: row.id,
        type: row.type,
        summary: row.summary,
        userId: row.userId,
        agentName: row.agentName,
        facilityId: row.facilityId,
        interactedAt: row.interactedAt,
        createdAt: row.createdAt,
      });
    }
    return map;
  }
}
