import {
  RELATIONSHIP_LEVEL_MAX,
  RELATIONSHIP_LEVEL_MIN,
  userProfessionalRelationships,
} from "@atlasmed/database";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ValidationError } from "../../../../../shared/errors";
import type {
  UserProfessionalRelationshipRecord,
  UserProfessionalRelationshipRepository,
} from "../../../application/interfaces/user-professional-relationship.repository.interface";

type Row = typeof userProfessionalRelationships.$inferSelect;

function mapRow(row: Row): UserProfessionalRelationshipRecord {
  return {
    id: row.id,
    userId: row.userId,
    professionalId: row.professionalId,
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

export class DrizzleUserProfessionalRelationshipRepository
  implements UserProfessionalRelationshipRepository
{
  async findByUserAndProfessional(
    userId: string,
    professionalId: string
  ): Promise<UserProfessionalRelationshipRecord | null> {
    const [row] = await db
      .select()
      .from(userProfessionalRelationships)
      .where(
        and(
          eq(userProfessionalRelationships.userId, userId),
          eq(userProfessionalRelationships.professionalId, professionalId)
        )
      )
      .limit(1);

    return row ? mapRow(row) : null;
  }

  async findLevelsByUserAndProfessionals(
    userId: string,
    professionalIds: string[]
  ): Promise<Map<string, number>> {
    if (professionalIds.length === 0) return new Map();

    const rows = await db
      .select({
        professionalId: userProfessionalRelationships.professionalId,
        relationshipLevel: userProfessionalRelationships.relationshipLevel,
      })
      .from(userProfessionalRelationships)
      .where(
        and(
          eq(userProfessionalRelationships.userId, userId),
          inArray(userProfessionalRelationships.professionalId, professionalIds)
        )
      );

    return new Map(
      rows.map((row) => [row.professionalId, row.relationshipLevel])
    );
  }

  async upsert(params: {
    userId: string;
    professionalId: string;
    relationshipLevel: number;
  }): Promise<UserProfessionalRelationshipRecord> {
    assertLevel(params.relationshipLevel);

    const [row] = await db
      .insert(userProfessionalRelationships)
      .values({
        userId: params.userId,
        professionalId: params.professionalId,
        relationshipLevel: params.relationshipLevel,
      })
      .onConflictDoUpdate({
        target: [
          userProfessionalRelationships.userId,
          userProfessionalRelationships.professionalId,
        ],
        set: {
          relationshipLevel: params.relationshipLevel,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapRow(row!);
  }

  async deleteByUserAndProfessional(
    userId: string,
    professionalId: string
  ): Promise<void> {
    await db
      .delete(userProfessionalRelationships)
      .where(
        and(
          eq(userProfessionalRelationships.userId, userId),
          eq(userProfessionalRelationships.professionalId, professionalId)
        )
      );
  }
}
