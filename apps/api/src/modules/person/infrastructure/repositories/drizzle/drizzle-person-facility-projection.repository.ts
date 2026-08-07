import {
  personFacilities,
  personFacilityClassificationAssignments,
  personFacilityRoleAssignments,
  personHealthcareProfiles,
  personProfessionalRegistrations,
  persons,
} from "@atlasmed/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import { isPostgresUniqueViolation } from "./postgres-unique-violation";
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
  classificationCodes: string[] | null;
  roleCodes: string[] | null;
};

const classificationCodesSql = sql<string[]>`coalesce(
  (
    SELECT array_agg(${personFacilityClassificationAssignments.classificationCode})
    FROM ${personFacilityClassificationAssignments}
    WHERE ${personFacilityClassificationAssignments.personFacilityId} = ${personFacilities.id}
  ),
  '{}'::text[]
)`;

const roleCodesSql = sql<string[]>`coalesce(
  (
    SELECT array_agg(${personFacilityRoleAssignments.roleCode} ORDER BY ${personFacilityRoleAssignments.roleCode})
    FROM ${personFacilityRoleAssignments}
    WHERE ${personFacilityRoleAssignments.personFacilityId} = ${personFacilities.id}
  ),
  '{}'::text[]
)`;

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
    classificationCodes: row.classificationCodes ?? [],
    roleCodes: row.roleCodes ?? [],
  };
}

export class DrizzlePersonFacilityProjectionRepository
  implements PersonFacilityProjectionRepository
{
  async listActiveByFacilityAndClassification(input: {
    facilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<PersonFacilityProjectionRecord[]> {
    const rows = await db
      .select({
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
        classificationCodes: classificationCodesSql,
        roleCodes: roleCodesSql,
      })
      .from(personFacilities)
      .innerJoin(persons, eq(persons.id, personFacilities.personId))
      .innerJoin(
        personFacilityClassificationAssignments,
        and(
          eq(personFacilityClassificationAssignments.personFacilityId, personFacilities.id),
          eq(
            personFacilityClassificationAssignments.classificationCode,
            input.classificationCode
          )
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
      .select({
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
        classificationCodes: classificationCodesSql,
        roleCodes: roleCodesSql,
      })
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

  async upsertPrimaryCrmRegistration(input: {
    personId: number;
    registrationNumber: string;
    stateCode: string;
  }): Promise<{ kind: "upserted"; id: number } | { kind: "conflict" }> {
    const registrationNumber = input.registrationNumber.trim();
    const stateCode = input.stateCode.trim().toUpperCase();

    try {
      return await db.transaction(async (tx) => {
        const [byKey] = await tx
          .select({
            id: personProfessionalRegistrations.id,
            personId: personProfessionalRegistrations.personId,
          })
          .from(personProfessionalRegistrations)
          .where(
            and(
              eq(personProfessionalRegistrations.councilCode, "CRM"),
              eq(personProfessionalRegistrations.stateCode, stateCode),
              eq(
                personProfessionalRegistrations.registrationNumber,
                registrationNumber
              )
            )
          )
          .limit(1);

        if (byKey && byKey.personId !== input.personId) {
          return { kind: "conflict" as const };
        }

        const [primary] = await tx
          .select({ id: personProfessionalRegistrations.id })
          .from(personProfessionalRegistrations)
          .where(
            and(
              eq(personProfessionalRegistrations.personId, input.personId),
              eq(personProfessionalRegistrations.isPrimary, true)
            )
          )
          .limit(1);

        if (byKey && primary && byKey.id !== primary.id) {
          await tx
            .update(personProfessionalRegistrations)
            .set({ isPrimary: false })
            .where(eq(personProfessionalRegistrations.id, primary.id));
          await tx
            .update(personProfessionalRegistrations)
            .set({ isPrimary: true, isActive: true })
            .where(eq(personProfessionalRegistrations.id, byKey.id));
          return { kind: "upserted" as const, id: byKey.id };
        }

        if (primary) {
          await tx
            .update(personProfessionalRegistrations)
            .set({
              councilCode: "CRM",
              stateCode,
              registrationNumber,
              isActive: true,
            })
            .where(eq(personProfessionalRegistrations.id, primary.id));
          return { kind: "upserted" as const, id: primary.id };
        }

        if (byKey) {
          await tx
            .update(personProfessionalRegistrations)
            .set({ isPrimary: true, isActive: true })
            .where(eq(personProfessionalRegistrations.id, byKey.id));
          return { kind: "upserted" as const, id: byKey.id };
        }

        const [created] = await tx
          .insert(personProfessionalRegistrations)
          .values({
            personId: input.personId,
            councilCode: "CRM",
            stateCode,
            registrationNumber,
            isPrimary: true,
            isActive: true,
          })
          .returning({ id: personProfessionalRegistrations.id });
        if (!created) {
          throw new DatabaseError("create person professional registration");
        }
        return { kind: "upserted" as const, id: created.id };
      });
    } catch (error) {
      // Race: concurrent insert/update hits Q19 unique (council, state, number).
      if (isPostgresUniqueViolation(error)) {
        return { kind: "conflict" };
      }
      throw error;
    }
  }

  async addClassification(input: {
    personFacilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<void> {
    await db
      .insert(personFacilityClassificationAssignments)
      .values({
        personFacilityId: input.personFacilityId,
        classificationCode: input.classificationCode,
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
    roleCodes: string[];
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(personFacilityRoleAssignments)
        .where(
          eq(personFacilityRoleAssignments.personFacilityId, input.personFacilityId)
        );

      if (input.roleCodes.length === 0) return;

      await tx.insert(personFacilityRoleAssignments).values(
        input.roleCodes.map((roleCode) => ({
          personFacilityId: input.personFacilityId,
          roleCode,
        }))
      );
    });
  }
}
