import {
  personHealthcareProfiles,
  personProfessionalRegistrationCouncils,
  personProfessionalRegistrations,
  persons,
} from "@atlasmed/database";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  CreatePersonProfessionalRegistrationInput,
  PersonProfessionalRegistrationRecord,
  PersonProfessionalRegistrationRepository,
  UpdatePersonProfessionalRegistrationInput,
} from "../../../application/interfaces/person-professional-registration.repository.interface";

const registrationSelect = {
  id: personProfessionalRegistrations.id,
  personId: personProfessionalRegistrations.personId,
  councilId: personProfessionalRegistrations.councilId,
  councilAbbreviation: personProfessionalRegistrationCouncils.abbreviation,
  councilName: personProfessionalRegistrationCouncils.name,
  stateCode: personProfessionalRegistrations.stateCode,
  registrationNumber: personProfessionalRegistrations.registrationNumber,
  isPrimary: personProfessionalRegistrations.isPrimary,
  isActive: personProfessionalRegistrations.isActive,
  createdAt: personProfessionalRegistrations.createdAt,
  updatedAt: personProfessionalRegistrations.updatedAt,
};

function mapRow(
  row: PersonProfessionalRegistrationRecord
): PersonProfessionalRegistrationRecord {
  return row;
}

export class DrizzlePersonProfessionalRegistrationRepository
  implements PersonProfessionalRegistrationRepository
{
  async findActivePersonById(personId: number): Promise<{ id: number } | null> {
    const [row] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async listByPersonId(
    personId: number,
    options?: { includeInactive?: boolean }
  ): Promise<PersonProfessionalRegistrationRecord[]> {
    const conditions = [eq(personProfessionalRegistrations.personId, personId)];
    if (!options?.includeInactive) {
      conditions.push(eq(personProfessionalRegistrations.isActive, true));
    }

    const rows = await db
      .select(registrationSelect)
      .from(personProfessionalRegistrations)
      .innerJoin(
        personProfessionalRegistrationCouncils,
        eq(
          personProfessionalRegistrations.councilId,
          personProfessionalRegistrationCouncils.id
        )
      )
      .where(and(...conditions))
      .orderBy(
        desc(personProfessionalRegistrations.isPrimary),
        asc(personProfessionalRegistrationCouncils.abbreviation),
        asc(personProfessionalRegistrations.stateCode),
        asc(personProfessionalRegistrations.registrationNumber)
      );

    return rows.map(mapRow);
  }

  async findByIdForPerson(
    registrationId: number,
    personId: number
  ): Promise<PersonProfessionalRegistrationRecord | null> {
    const [row] = await db
      .select(registrationSelect)
      .from(personProfessionalRegistrations)
      .innerJoin(
        personProfessionalRegistrationCouncils,
        eq(
          personProfessionalRegistrations.councilId,
          personProfessionalRegistrationCouncils.id
        )
      )
      .where(
        and(
          eq(personProfessionalRegistrations.id, registrationId),
          eq(personProfessionalRegistrations.personId, personId)
        )
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async create(
    input: CreatePersonProfessionalRegistrationInput
  ): Promise<PersonProfessionalRegistrationRecord> {
    return db.transaction(async (tx) => {
      await tx
        .insert(personHealthcareProfiles)
        .values({ personId: input.personId })
        .onConflictDoNothing({ target: personHealthcareProfiles.personId });

      if (input.isPrimary) {
        await tx
          .update(personProfessionalRegistrations)
          .set({ isPrimary: false })
          .where(
            and(
              eq(personProfessionalRegistrations.personId, input.personId),
              eq(personProfessionalRegistrations.isPrimary, true)
            )
          );
      }

      const [inserted] = await tx
        .insert(personProfessionalRegistrations)
        .values({
          personId: input.personId,
          councilId: input.councilId,
          stateCode: input.stateCode,
          registrationNumber: input.registrationNumber,
          isPrimary: input.isPrimary,
          isActive: true,
        })
        .returning({ id: personProfessionalRegistrations.id });

      if (!inserted) {
        throw new Error("insert person_professional_registrations returned no row");
      }

      const [row] = await tx
        .select(registrationSelect)
        .from(personProfessionalRegistrations)
        .innerJoin(
          personProfessionalRegistrationCouncils,
          eq(
            personProfessionalRegistrations.councilId,
            personProfessionalRegistrationCouncils.id
          )
        )
        .where(eq(personProfessionalRegistrations.id, inserted.id))
        .limit(1);

      return mapRow(row!);
    });
  }

  async update(
    input: UpdatePersonProfessionalRegistrationInput
  ): Promise<PersonProfessionalRegistrationRecord | null> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: personProfessionalRegistrations.id,
          isPrimary: personProfessionalRegistrations.isPrimary,
          isActive: personProfessionalRegistrations.isActive,
        })
        .from(personProfessionalRegistrations)
        .where(
          and(
            eq(personProfessionalRegistrations.id, input.registrationId),
            eq(personProfessionalRegistrations.personId, input.personId)
          )
        )
        .limit(1);

      if (!existing) return null;

      const nextIsPrimary = input.isPrimary ?? existing.isPrimary;
      const nextIsActive =
        input.isActive !== undefined ? input.isActive : existing.isActive;

      // Soft-deactivate always clears primary (partial unique has no isActive filter).
      const resolvedPrimary =
        nextIsActive === false ? false : nextIsPrimary;

      if (resolvedPrimary) {
        await tx
          .update(personProfessionalRegistrations)
          .set({ isPrimary: false })
          .where(
            and(
              eq(personProfessionalRegistrations.personId, input.personId),
              eq(personProfessionalRegistrations.isPrimary, true)
            )
          );
      }

      const setData: {
        councilId?: number;
        stateCode?: string;
        registrationNumber?: string;
        isPrimary: boolean;
        isActive?: boolean;
      } = {
        isPrimary: resolvedPrimary,
      };
      if (input.councilId !== undefined) setData.councilId = input.councilId;
      if (input.stateCode !== undefined) setData.stateCode = input.stateCode;
      if (input.registrationNumber !== undefined) {
        setData.registrationNumber = input.registrationNumber;
      }
      if (input.isActive !== undefined) setData.isActive = input.isActive;

      await tx
        .update(personProfessionalRegistrations)
        .set(setData)
        .where(eq(personProfessionalRegistrations.id, input.registrationId));

      const [row] = await tx
        .select(registrationSelect)
        .from(personProfessionalRegistrations)
        .innerJoin(
          personProfessionalRegistrationCouncils,
          eq(
            personProfessionalRegistrations.councilId,
            personProfessionalRegistrationCouncils.id
          )
        )
        .where(eq(personProfessionalRegistrations.id, input.registrationId))
        .limit(1);

      return row ? mapRow(row) : null;
    });
  }

  async deactivate(input: {
    registrationId: number;
    personId: number;
  }): Promise<PersonProfessionalRegistrationRecord | null> {
    return this.update({
      registrationId: input.registrationId,
      personId: input.personId,
      isActive: false,
      isPrimary: false,
    });
  }
}
