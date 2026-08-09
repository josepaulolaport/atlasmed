import {
  RELATIONSHIP_LEVEL_MAX,
  RELATIONSHIP_LEVEL_MIN,
  persons,
  userPersonRelationships,
} from "@atlasmed/database";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ValidationError } from "../../../../../shared/errors";
import type {
  UserPersonRelationshipRecord,
  UserPersonRelationshipRepository,
} from "../../../application/interfaces/user-person-relationship.repository.interface";

type Row = typeof userPersonRelationships.$inferSelect;

function mapRow(row: Row): UserPersonRelationshipRecord {
  return {
    id: row.id,
    userId: row.userId,
    personId: row.personId,
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

export class DrizzleUserPersonRelationshipRepository
  implements UserPersonRelationshipRepository
{
  async findActivePersonById(personId: number): Promise<{ id: number } | null> {
    const [row] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByUserAndPerson(
    userId: number,
    personId: number
  ): Promise<UserPersonRelationshipRecord | null> {
    const [row] = await db
      .select()
      .from(userPersonRelationships)
      .where(
        and(
          eq(userPersonRelationships.userId, userId),
          eq(userPersonRelationships.personId, personId)
        )
      )
      .limit(1);

    return row ? mapRow(row) : null;
  }

  async findLevelsByUserAndPersons(
    userId: number,
    personIds: number[]
  ): Promise<Map<number, number>> {
    if (personIds.length === 0) return new Map();

    const rows = await db
      .select({
        personId: userPersonRelationships.personId,
        relationshipLevel: userPersonRelationships.relationshipLevel,
      })
      .from(userPersonRelationships)
      .where(
        and(
          eq(userPersonRelationships.userId, userId),
          inArray(userPersonRelationships.personId, personIds)
        )
      );

    return new Map(rows.map((row) => [row.personId, row.relationshipLevel]));
  }

  async upsert(params: {
    userId: number;
    personId: number;
    relationshipLevel: number;
  }): Promise<UserPersonRelationshipRecord> {
    assertLevel(params.relationshipLevel);

    const [row] = await db
      .insert(userPersonRelationships)
      .values({
        userId: params.userId,
        personId: params.personId,
        relationshipLevel: params.relationshipLevel,
      })
      .onConflictDoUpdate({
        target: [
          userPersonRelationships.userId,
          userPersonRelationships.personId,
        ],
        set: {
          relationshipLevel: params.relationshipLevel,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapRow(row!);
  }
}
