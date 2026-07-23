import {
  RELATIONSHIP_LEVEL_MAX,
  RELATIONSHIP_LEVEL_MIN,
  userRepresentativeRelationships,
} from "@atlasmed/database";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ValidationError } from "../../../../../shared/errors";
import type {
  UserRepresentativeRelationshipRecord,
  UserRepresentativeRelationshipRepository,
} from "../../../application/interfaces/user-representative-relationship.repository.interface";

type Row = typeof userRepresentativeRelationships.$inferSelect;

function mapRow(row: Row): UserRepresentativeRelationshipRecord {
  return {
    id: row.id,
    userId: row.userId,
    representativeId: row.representativeId,
    relationshipLevel: row.relationshipLevel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertLevel(level: number) {
  if (
    !Number.isInteger(level) ||
    level < RELATIONSHIP_LEVEL_MIN ||
    level > RELATIONSHIP_LEVEL_MAX
  ) {
    throw new ValidationError([
      {
        field: "relationshipLevel",
        message: `Must be an integer between ${RELATIONSHIP_LEVEL_MIN} and ${RELATIONSHIP_LEVEL_MAX}`,
      },
    ]);
  }
}

export class DrizzleUserRepresentativeRelationshipRepository
  implements UserRepresentativeRelationshipRepository
{
  async findByUserAndRepresentative(
    userId: string,
    representativeId: string
  ): Promise<UserRepresentativeRelationshipRecord | null> {
    const [row] = await db
      .select()
      .from(userRepresentativeRelationships)
      .where(
        and(
          eq(userRepresentativeRelationships.userId, userId),
          eq(userRepresentativeRelationships.representativeId, representativeId)
        )
      )
      .limit(1);

    return row ? mapRow(row) : null;
  }

  async findLevelsByUserAndRepresentatives(
    userId: string,
    representativeIds: string[]
  ): Promise<Map<string, number>> {
    if (representativeIds.length === 0) return new Map();

    const rows = await db
      .select({
        representativeId: userRepresentativeRelationships.representativeId,
        relationshipLevel: userRepresentativeRelationships.relationshipLevel,
      })
      .from(userRepresentativeRelationships)
      .where(
        and(
          eq(userRepresentativeRelationships.userId, userId),
          inArray(
            userRepresentativeRelationships.representativeId,
            representativeIds
          )
        )
      );

    return new Map(
      rows.map((row) => [row.representativeId, row.relationshipLevel])
    );
  }

  async upsert(params: {
    userId: string;
    representativeId: string;
    relationshipLevel: number;
  }): Promise<UserRepresentativeRelationshipRecord> {
    assertLevel(params.relationshipLevel);

    const [row] = await db
      .insert(userRepresentativeRelationships)
      .values({
        userId: params.userId,
        representativeId: params.representativeId,
        relationshipLevel: params.relationshipLevel,
      })
      .onConflictDoUpdate({
        target: [
          userRepresentativeRelationships.userId,
          userRepresentativeRelationships.representativeId,
        ],
        set: {
          relationshipLevel: params.relationshipLevel,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapRow(row!);
  }

  async deleteByUserAndRepresentative(
    userId: string,
    representativeId: string
  ): Promise<void> {
    await db
      .delete(userRepresentativeRelationships)
      .where(
        and(
          eq(userRepresentativeRelationships.userId, userId),
          eq(userRepresentativeRelationships.representativeId, representativeId)
        )
      );
  }
}
