import { and, eq, isNull, sql } from "drizzle-orm";
import {
  facilities,
  facilityVerticalProfiles,
  healthcareSpecialties,
  personFacilities,
  personHealthcareProfileSpecialties,
  personHealthcareProfiles,
  personProfessionalRegistrationCouncils,
  personProfessionalRegistrations,
  persons,
} from "@atlasmed/database";
import { normalizeSearchFilterValue } from "../../shared/normalize-search-filter";
import { db } from "../database/db";
import { logger } from "../logging/logger";
import { searchService } from "./search.service";

/**
 * Keep in sync with `formatPrimaryRegistrationDisplay` in
 * person load-primary-registration-display-map (and worker rebuild).
 */
function formatRegistrationDisplay(input: {
  councilAbbreviation: string;
  stateCode: string;
  registrationNumber: string;
}): string {
  return `${input.councilAbbreviation}/${input.stateCode} ${input.registrationNumber}`;
}

/**
 * Q31 Meili persons document — keep field list in sync with
 * apps/workers/temporal/src/search/rebuild.ts `PersonSearchDocument` / ADR 0004 §6.4.
 */
type PersonSearchDocument = {
  id: string;
  name: string;
  socialName: string | null;
  cpf: string | null;
  specialty: string | null;
  specialtyNormalized: string | null;
  activeFacilityIds: number[];
  /**
   * Active links carrying the `HEALTHCARE_PROFESSIONAL` classification.
   *
   * Distinct from [activeFacilityIds], which is every link whatever its nature
   * and backs scope enforcement. The associate-doctors picker excludes on this
   * one so it agrees with its SQL condition.
   */
  clinicalFacilityIds: number[];
  activeTerritoryIds: number[];
  registrationDisplays: string[];
};

/**
 * Upsert one person into Meili after registration writes so
 * `registrationDisplays` stay searchable without a full Temporal rebuild.
 */
export async function upsertPersonSearchDocument(
  personId: number
): Promise<void> {
  if (!searchService.isConfigured()) return;

  try {
    const [row] = await db
      .select({
        id: persons.id,
        firstName: persons.firstName,
        lastName: persons.lastName,
        socialName: persons.socialName,
        cpf: persons.cpf,
        deletedAt: persons.deletedAt,
        healthcarePersonId: personHealthcareProfiles.personId,
      })
      .from(persons)
      .leftJoin(
        personHealthcareProfiles,
        eq(personHealthcareProfiles.personId, persons.id)
      )
      .where(eq(persons.id, personId))
      .limit(1);

    if (!row || row.deletedAt || row.healthcarePersonId == null) {
      await searchService.deleteDocument("persons", String(personId));
      return;
    }

    const [associations, primarySpecialtyLabel, registrationDisplays] =
      await Promise.all([
        loadActivePersonAssociations(personId),
        loadPrimarySpecialtyLabel(personId),
        loadActiveRegistrationDisplays(personId),
      ]);

    const activeFacilityIds = [
      ...new Set(associations.map((association) => association.facilityId)),
    ].sort((a, b) => a - b);
    const clinicalFacilityIds = [
      ...new Set(
        associations.flatMap((association) =>
          association.isClinical ? [association.facilityId] : []
        )
      ),
    ].sort((a, b) => a - b);
    const activeTerritoryIds = [
      ...new Set(
        associations.flatMap((association) =>
          association.territoryId ? [association.territoryId] : []
        )
      ),
    ].sort((a, b) => a - b);

    const document: PersonSearchDocument = {
      id: String(row.id),
      name: `${row.firstName} ${row.lastName}`.trim(),
      socialName: row.socialName,
      cpf: row.cpf,
      specialty: primarySpecialtyLabel,
      specialtyNormalized: primarySpecialtyLabel
        ? normalizeSearchFilterValue(primarySpecialtyLabel)
        : null,
      activeFacilityIds,
      clinicalFacilityIds,
      activeTerritoryIds,
      registrationDisplays,
    };

    await searchService.updateDocuments("persons", [document]);
  } catch (error) {
    // Search index lag is non-fatal — list path falls back to SQL.
    logger.warn("search.person_upsert_failed", {
      personId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

type PersonAssociation = {
  facilityId: number;
  territoryId: number | null;
  isClinical: boolean;
};

async function loadActivePersonAssociations(
  personId: number
): Promise<PersonAssociation[]> {
  const rows = await db
    .select({
      facilityId: personFacilities.facilityId,
      territoryId: facilityVerticalProfiles.managerZoneId,
      // Correlated rather than joined, so an association is not multiplied by
      // its classifications. Mirrors the worker rebuild.
      isClinical: sql<boolean>`exists (
        select 1
        from person_facility_classification_assignments pfca
        join person_facility_classifications pfc
          on pfc.id = pfca.classification_id
        where pfca.person_facility_id = ${personFacilities.id}
          and pfc.code = 'HEALTHCARE_PROFESSIONAL'
      )`,
    })
    .from(personFacilities)
    .innerJoin(facilities, eq(personFacilities.facilityId, facilities.id))
    .leftJoin(
      facilityVerticalProfiles,
      and(
        eq(facilityVerticalProfiles.facilityId, facilities.id),
        eq(facilityVerticalProfiles.isActive, true)
      )
    )
    .where(
      and(
        eq(personFacilities.personId, personId),
        isNull(personFacilities.endedAt),
        isNull(facilities.deactivatedAt)
      )
    );

  const associations: PersonAssociation[] = [];
  for (const row of rows) {
    const already = associations.find(
      (entry) =>
        entry.facilityId === row.facilityId &&
        entry.territoryId === row.territoryId
    );
    if (already) {
      // An administrative link and a clinical one to the same clinic collapse
      // here. OR-ed rather than overwritten, so the outcome does not depend on
      // which row the database returned first.
      already.isClinical = already.isClinical || row.isClinical;
      continue;
    }
    associations.push({
      facilityId: row.facilityId,
      territoryId: row.territoryId,
      isClinical: row.isClinical,
    });
  }
  return associations;
}

async function loadPrimarySpecialtyLabel(
  personId: number
): Promise<string | null> {
  const [row] = await db
    .select({
      specialtyName: healthcareSpecialties.name,
    })
    .from(personHealthcareProfileSpecialties)
    .innerJoin(
      healthcareSpecialties,
      eq(healthcareSpecialties.id, personHealthcareProfileSpecialties.specialtyId)
    )
    .where(
      and(
        eq(personHealthcareProfileSpecialties.personId, personId),
        eq(personHealthcareProfileSpecialties.isPrimary, true)
      )
    )
    .limit(1);

  return row?.specialtyName ?? null;
}

async function loadActiveRegistrationDisplays(
  personId: number
): Promise<string[]> {
  const rows = await db
    .select({
      councilAbbreviation: personProfessionalRegistrationCouncils.abbreviation,
      stateCode: personProfessionalRegistrations.stateCode,
      registrationNumber: personProfessionalRegistrations.registrationNumber,
      isPrimary: personProfessionalRegistrations.isPrimary,
    })
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
        eq(personProfessionalRegistrations.personId, personId),
        eq(personProfessionalRegistrations.isActive, true)
      )
    );

  rows.sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const byAbbrev = left.councilAbbreviation.localeCompare(
      right.councilAbbreviation,
      "pt-BR"
    );
    if (byAbbrev !== 0) return byAbbrev;
    const byState = left.stateCode.localeCompare(right.stateCode, "pt-BR");
    if (byState !== 0) return byState;
    return left.registrationNumber.localeCompare(
      right.registrationNumber,
      "pt-BR"
    );
  });

  return rows.map((row) =>
    formatRegistrationDisplay({
      councilAbbreviation: row.councilAbbreviation,
      stateCode: row.stateCode,
      registrationNumber: row.registrationNumber,
    })
  );
}
