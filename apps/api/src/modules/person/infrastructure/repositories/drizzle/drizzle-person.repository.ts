import {
  facilities,
  healthcareSpecialties,
  personFacilities,
  personHealthcareProfileSpecialties,
  personHealthcareProfiles,
  persons,
} from "@atlasmed/database";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  PatchPersonInput,
  PersonRecord,
  PersonRepository,
} from "../../../application/interfaces/person.repository.interface";

export class DrizzlePersonRepository implements PersonRepository {
  async findActiveById(personId: number): Promise<PersonRecord | null> {
    const [row] = await db
      .select({
        id: persons.id,
        firstName: persons.firstName,
        lastName: persons.lastName,
        socialName: persons.socialName,
        cpf: persons.cpf,
        email: persons.email,
        mobilePhone: persons.mobilePhone,
        landlinePhone: persons.landlinePhone,
        birthDate: persons.birthDate,
        favoriteTeam: persons.favoriteTeam,
        hobbies: persons.hobbies,
        languages: persons.languages,
        imageUrl: persons.imageUrl,
        hasHealthcareProfile: sql<boolean>`exists (
          select 1 from ${personHealthcareProfiles} php
          where php.person_id = ${persons.id}
        )`,
      })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);

    if (!row) return null;

    /**
     * Names, not only ids.
     *
     * The response carried `facilityIds` alone, so every consumer that wanted
     * to *show* where a person works had nothing to show: mobile's
     * `Professional.clinics` maps a `facilities` array the API never sent, and
     * the doctor's CLÍNICAS section was permanently empty — including for a
     * doctor opened from the very clinic they are linked to.
     *
     * Deactivated clinics are left out: they are not somewhere anyone can be
     * visited. `facilityIds` keeps its own shape for existing callers.
     */
    const facilityRows = await db
      .select({
        facilityId: personFacilities.facilityId,
        facilityName: facilities.displayName,
      })
      .from(personFacilities)
      .innerJoin(facilities, eq(facilities.id, personFacilities.facilityId))
      .where(
        and(
          eq(personFacilities.personId, personId),
          isNull(personFacilities.endedAt),
          isNull(facilities.deactivatedAt)
        )
      )
      .orderBy(asc(facilities.displayName));

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      socialName: row.socialName,
      cpf: row.cpf,
      email: row.email,
      mobilePhone: row.mobilePhone,
      landlinePhone: row.landlinePhone,
      birthDate: row.birthDate,
      favoriteTeam: row.favoriteTeam,
      hobbies: row.hobbies,
      languages: row.languages,
      imageUrl: row.imageUrl,
      facilityIds: facilityRows.map((r) => r.facilityId),
      facilities: facilityRows.map((r) => ({
        id: r.facilityId,
        name: r.facilityName,
      })),
      hasHealthcareProfile: Boolean(row.hasHealthcareProfile),
    };
  }

  async update(personId: number, input: PatchPersonInput): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.socialName !== undefined) patch.socialName = input.socialName;
    if (input.cpf !== undefined) patch.cpf = input.cpf;
    if (input.email !== undefined) patch.email = input.email;
    if (input.mobilePhone !== undefined) patch.mobilePhone = input.mobilePhone;
    if (input.landlinePhone !== undefined) {
      patch.landlinePhone = input.landlinePhone;
    }
    if (input.birthDate !== undefined) patch.birthDate = input.birthDate;
    if (input.favoriteTeam !== undefined) patch.favoriteTeam = input.favoriteTeam;
    if (input.hobbies !== undefined) patch.hobbies = input.hobbies;
    if (input.languages !== undefined) patch.languages = input.languages;
    if (Object.keys(patch).length === 0) return;

    await db.update(persons).set(patch).where(eq(persons.id, personId));
  }

  async listDistinctSpecialtyNames(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ name: healthcareSpecialties.name })
      .from(healthcareSpecialties)
      .innerJoin(
        personHealthcareProfileSpecialties,
        eq(
          personHealthcareProfileSpecialties.specialtyId,
          healthcareSpecialties.id
        )
      )
      .innerJoin(
        persons,
        eq(persons.id, personHealthcareProfileSpecialties.personId)
      )
      .where(
        and(eq(healthcareSpecialties.isActive, true), isNull(persons.deletedAt))
      )
      .orderBy(asc(healthcareSpecialties.name));

    return rows
      .map((row) => row.name.trim())
      .filter((name) => name.length > 0);
  }
}
