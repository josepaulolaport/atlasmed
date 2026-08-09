import {
  personFacilities,
  personFacilityClassificationAssignments,
  personFacilityClassifications,
  personFacilityRoleAssignments,
  personFacilityRoles,
  personHealthcareProfiles,
  persons,
} from "@atlasmed/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import type {
  ClassificationCode,
  CreatePersonInput,
  PersonFacilityProjectionRecord,
  PersonFacilityProjectionRepository,
  UpdateAffiliationInput,
  UpdatePersonInput,
} from "../../../application/interfaces/person-facility-projection.repository.interface";

type Row = {
  personFacilityId: number;
  personId: number;
  facilityId: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  email: string | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  roleTitle: string | null;
  notes: string | null;
  endedAt: Date | null;
  hasHealthcareProfile: boolean;
  classificationIds: number[] | null;
  classificationCodes: string[] | null;
  roleIds: number[] | null;
};

const classificationIdsSql = sql<number[]>`coalesce(
  (
    SELECT array_agg(a.classification_id::int ORDER BY c.code)
    FROM ${personFacilityClassificationAssignments} a
    INNER JOIN ${personFacilityClassifications} c ON c.id = a.classification_id
    WHERE a.person_facility_id = ${personFacilities.id}
  ),
  '{}'::int[]
)`;

const classificationCodesSql = sql<string[]>`coalesce(
  (
    SELECT array_agg(c.code ORDER BY c.code)
    FROM ${personFacilityClassificationAssignments} a
    INNER JOIN ${personFacilityClassifications} c ON c.id = a.classification_id
    WHERE a.person_facility_id = ${personFacilities.id}
  ),
  '{}'::text[]
)`;

const roleIdsSql = sql<number[]>`coalesce(
  (
    SELECT array_agg(a.role_id::int ORDER BY r.name, a.role_id)
    FROM ${personFacilityRoleAssignments} a
    INNER JOIN ${personFacilityRoles} r ON r.id = a.role_id
    WHERE a.person_facility_id = ${personFacilities.id}
  ),
  '{}'::int[]
)`;

/** pg/drizzle may surface bigint[] members as strings — CRM DTO contract is number[]. */
function asIdList(value: number[] | null | undefined): number[] {
  if (!value?.length) return [];
  return value.map((id) => Number(id));
}

function mapRow(row: Row): PersonFacilityProjectionRecord {
  return {
    personFacilityId: row.personFacilityId,
    personId: row.personId,
    facilityId: row.facilityId,
    firstName: row.firstName,
    lastName: row.lastName,
    socialName: row.socialName,
    cpf: row.cpf,
    email: row.email,
    mobilePhone: row.mobilePhone,
    landlinePhone: row.landlinePhone,
    roleTitle: row.roleTitle,
    notes: row.notes,
    endedAt: row.endedAt,
    hasHealthcareProfile: row.hasHealthcareProfile,
    classificationIds: asIdList(row.classificationIds),
    classificationCodes: row.classificationCodes ?? [],
    roleIds: asIdList(row.roleIds),
  };
}

const projectionSelect = {
  personFacilityId: personFacilities.id,
  personId: persons.id,
  facilityId: personFacilities.facilityId,
  firstName: persons.firstName,
  lastName: persons.lastName,
  socialName: persons.socialName,
  cpf: persons.cpf,
  email: persons.email,
  mobilePhone: persons.mobilePhone,
  landlinePhone: persons.landlinePhone,
  roleTitle: personFacilities.roleTitle,
  notes: personFacilities.notes,
  endedAt: personFacilities.endedAt,
  hasHealthcareProfile: sql<boolean>`(${personHealthcareProfiles.personId} IS NOT NULL)`,
  classificationIds: classificationIdsSql,
  classificationCodes: classificationCodesSql,
  roleIds: roleIdsSql,
};

export class DrizzlePersonFacilityProjectionRepository
  implements PersonFacilityProjectionRepository
{
  async listActiveByFacilityAndClassification(input: {
    facilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<PersonFacilityProjectionRecord[]> {
    const rows = await db
      .select(projectionSelect)
      .from(personFacilities)
      .innerJoin(persons, eq(persons.id, personFacilities.personId))
      .innerJoin(
        personFacilityClassificationAssignments,
        eq(personFacilityClassificationAssignments.personFacilityId, personFacilities.id)
      )
      .innerJoin(
        personFacilityClassifications,
        and(
          eq(
            personFacilityClassifications.id,
            personFacilityClassificationAssignments.classificationId
          ),
          eq(personFacilityClassifications.code, input.classificationCode)
        )
      )
      .leftJoin(
        personHealthcareProfiles,
        eq(personHealthcareProfiles.personId, persons.id)
      )
      .where(
        and(
          eq(personFacilities.facilityId, input.facilityId),
          isNull(personFacilities.endedAt),
          isNull(persons.deletedAt)
        )
      )
      .orderBy(persons.lastName, persons.firstName);

    return rows.map(mapRow);
  }

  async findActiveById(
    personFacilityId: number
  ): Promise<PersonFacilityProjectionRecord | null> {
    const [row] = await db
      .select(projectionSelect)
      .from(personFacilities)
      .innerJoin(persons, eq(persons.id, personFacilities.personId))
      .leftJoin(
        personHealthcareProfiles,
        eq(personHealthcareProfiles.personId, persons.id)
      )
      .where(and(eq(personFacilities.id, personFacilityId), isNull(persons.deletedAt)))
      .limit(1);

    return row ? mapRow(row) : null;
  }

  async findActiveAffiliation(input: {
    facilityId: number;
    personId: number;
  }): Promise<{ id: number; facilityId: number; personId: number } | null> {
    const [row] = await db
      .select({
        id: personFacilities.id,
        facilityId: personFacilities.facilityId,
        personId: personFacilities.personId,
      })
      .from(personFacilities)
      .where(
        and(
          eq(personFacilities.facilityId, input.facilityId),
          eq(personFacilities.personId, input.personId),
          isNull(personFacilities.endedAt)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async findPersonById(
    personId: number
  ): Promise<{ id: number; deletedAt: Date | null } | null> {
    const [row] = await db
      .select({ id: persons.id, deletedAt: persons.deletedAt })
      .from(persons)
      .where(eq(persons.id, personId))
      .limit(1);
    return row ?? null;
  }

  async createPerson(input: CreatePersonInput): Promise<{ id: number }> {
    const [row] = await db
      .insert(persons)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        socialName: input.socialName ?? null,
        cpf: input.cpf ?? null,
        email: input.email ?? null,
        mobilePhone: input.mobilePhone ?? null,
        landlinePhone: input.landlinePhone ?? null,
      })
      .returning({ id: persons.id });
    if (!row) throw new DatabaseError("create person");
    return row;
  }

  async ensureHealthcareProfile(personId: number): Promise<void> {
    await db
      .insert(personHealthcareProfiles)
      .values({ personId })
      .onConflictDoNothing({ target: personHealthcareProfiles.personId });
  }

  async createAffiliation(input: {
    personId: number;
    facilityId: number;
    roleTitle?: string | null;
    notes?: string | null;
  }): Promise<{ id: number }> {
    const [row] = await db
      .insert(personFacilities)
      .values({
        personId: input.personId,
        facilityId: input.facilityId,
        roleTitle: input.roleTitle ?? null,
        notes: input.notes ?? null,
      })
      .returning({ id: personFacilities.id });
    if (!row) throw new DatabaseError("create person facility affiliation");
    return row;
  }

  async addClassification(input: {
    personFacilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<void> {
    const [classification] = await db
      .select({ id: personFacilityClassifications.id })
      .from(personFacilityClassifications)
      .where(eq(personFacilityClassifications.code, input.classificationCode))
      .limit(1);

    if (!classification) {
      throw new DatabaseError(
        `unknown person facility classification: ${input.classificationCode}`
      );
    }

    await db
      .insert(personFacilityClassificationAssignments)
      .values({
        personFacilityId: input.personFacilityId,
        classificationId: classification.id,
      })
      .onConflictDoNothing();
  }

  async updatePerson(personId: number, input: UpdatePersonInput): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.socialName !== undefined) patch.socialName = input.socialName;
    if (input.cpf !== undefined) patch.cpf = input.cpf;
    if (input.email !== undefined) patch.email = input.email;
    if (input.mobilePhone !== undefined) patch.mobilePhone = input.mobilePhone;
    if (input.landlinePhone !== undefined) patch.landlinePhone = input.landlinePhone;
    if (Object.keys(patch).length === 0) return;
    await db.update(persons).set(patch).where(eq(persons.id, personId));
  }

  async updateAffiliation(
    personFacilityId: number,
    input: UpdateAffiliationInput
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.roleTitle !== undefined) patch.roleTitle = input.roleTitle;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (Object.keys(patch).length === 0) return;
    await db
      .update(personFacilities)
      .set(patch)
      .where(eq(personFacilities.id, personFacilityId));
  }

  async endAffiliation(input: {
    personFacilityId: number;
    endedByUserId: number;
    endedAt: Date;
  }): Promise<{ endedAt: Date } | null> {
    const [row] = await db
      .update(personFacilities)
      .set({
        endedAt: input.endedAt,
        endedByUserId: input.endedByUserId,
      })
      .where(
        and(eq(personFacilities.id, input.personFacilityId), isNull(personFacilities.endedAt))
      )
      .returning({ endedAt: personFacilities.endedAt });

    if (!row?.endedAt) return null;
    return { endedAt: row.endedAt };
  }

  async replaceRoleAssignments(input: {
    personFacilityId: number;
    roleIds: number[];
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(personFacilityRoleAssignments)
        .where(
          eq(personFacilityRoleAssignments.personFacilityId, input.personFacilityId)
        );

      if (input.roleIds.length === 0) return;

      await tx.insert(personFacilityRoleAssignments).values(
        input.roleIds.map((roleId) => ({
          personFacilityId: input.personFacilityId,
          roleId,
        }))
      );
    });
  }
}
