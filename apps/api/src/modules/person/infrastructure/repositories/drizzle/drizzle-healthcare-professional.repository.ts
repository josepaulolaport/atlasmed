import {
  facilities,
  healthcareSpecialties,
  personFacilities,
  personHealthcareProfileSpecialties,
  personHealthcareProfiles,
  persons,
} from "@atlasmed/database";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  HealthcareProfessionalFacilitySummary,
  HealthcareProfessionalListScopeFilter,
  HealthcareProfessionalRecord,
  HealthcareProfessionalRepository,
} from "../../../application/interfaces/healthcare-professional.repository.interface";
import { parseSpecialtyFilterValues } from "../../../application/specialty-filter";
import { loadPrimaryRegistrationDisplayMap } from "./load-primary-registration-display-map";

type PersonFacilityAssociation = {
  facilityId: number;
  facilityName: string;
  endedAt: Date | null;
};

type PersonEnrichment = {
  specialty: string | null;
};

function resolveFacilityName(row: {
  id: number;
  displayName: string | null;
  legalName: string | null;
  tradeName: string | null;
}): string {
  return (
    row.displayName?.trim() ||
    row.tradeName?.trim() ||
    row.legalName?.trim() ||
    String(row.id)
  );
}

function mapRecord(
  person: {
    id: number;
    firstName: string;
    lastName: string;
    socialName: string | null;
    cpf: string | null;
    createdAt: Date;
    updatedAt: Date;
    distanceKm?: number | null;
  },
  enrichment: PersonEnrichment,
  facilityAssociations: PersonFacilityAssociation[],
  primaryRegistrationDisplay: string | null = null
): HealthcareProfessionalRecord {
  const activeFacilities = facilityAssociations
    .filter((association) => association.endedAt === null)
    .sort((left, right) =>
      left.facilityName.localeCompare(right.facilityName, "pt-BR")
    );
  const displayFacility = activeFacilities[0];

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    socialName: person.socialName,
    cpf: person.cpf,
    specialty: enrichment.specialty,
    facilityIds: [
      ...new Set(activeFacilities.map((association) => association.facilityId)),
    ],
    displayFacility: displayFacility
      ? { id: displayFacility.facilityId, name: displayFacility.facilityName }
      : null,
    primaryRegistrationDisplay,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    distanceKm: person.distanceKm ?? null,
  };
}

async function loadAssociationsMap(
  personIds: number[],
  visibleFacilityIds?: number[]
): Promise<Map<number, PersonFacilityAssociation[]>> {
  if (personIds.length === 0) return new Map();

  const rows = await db
    .select({
      personId: personFacilities.personId,
      facilityId: personFacilities.facilityId,
      displayName: facilities.displayName,
      legalName: facilities.legalName,
      tradeName: facilities.tradeName,
      endedAt: personFacilities.endedAt,
    })
    .from(personFacilities)
    .innerJoin(facilities, eq(facilities.id, personFacilities.facilityId))
    .where(
      and(
        inArray(personFacilities.personId, personIds),
        isNull(facilities.deactivatedAt),
        ...(visibleFacilityIds
          ? [inArray(personFacilities.facilityId, visibleFacilityIds)]
          : [])
      )
    );

  const map = new Map<number, PersonFacilityAssociation[]>();
  for (const row of rows) {
    if (!map.has(row.personId)) map.set(row.personId, []);
    map.get(row.personId)!.push({
      facilityId: row.facilityId,
      facilityName: resolveFacilityName({
        id: row.facilityId,
        displayName: row.displayName,
        legalName: row.legalName,
        tradeName: row.tradeName,
      }),
      endedAt: row.endedAt,
    });
  }
  return map;
}

async function loadEnrichmentMap(
  personIds: number[]
): Promise<Map<number, PersonEnrichment>> {
  const map = new Map<number, PersonEnrichment>();
  if (personIds.length === 0) return map;

  for (const id of personIds) {
    map.set(id, { specialty: null });
  }

  const specialtyRows = await db
    .select({
      personId: personHealthcareProfileSpecialties.personId,
      specialtyName: healthcareSpecialties.name,
    })
    .from(personHealthcareProfileSpecialties)
    .innerJoin(
      healthcareSpecialties,
      eq(healthcareSpecialties.id, personHealthcareProfileSpecialties.specialtyId)
    )
    .where(
      and(
        inArray(personHealthcareProfileSpecialties.personId, personIds),
        eq(personHealthcareProfileSpecialties.isPrimary, true)
      )
    );

  for (const row of specialtyRows) {
    const current = map.get(row.personId)!;
    current.specialty = row.specialtyName;
  }

  return map;
}

function buildOrderBy(params: { order?: "asc" | "desc" }) {
  const direction = params.order === "desc" ? desc : asc;
  return [direction(persons.lastName), direction(persons.firstName)];
}

function scopedPersonIdsSubquery(facilityIds: number[]) {
  return db
    .select({ id: personFacilities.personId })
    .from(personFacilities)
    .innerJoin(facilities, eq(facilities.id, personFacilities.facilityId))
    .where(
      and(
        inArray(personFacilities.facilityId, facilityIds),
        isNull(personFacilities.endedAt),
        isNull(facilities.deactivatedAt)
      )
    );
}

export class DrizzleHealthcareProfessionalRepository
  implements HealthcareProfessionalRepository
{
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    sort?: string;
    order?: "asc" | "desc";
    scope: HealthcareProfessionalListScopeFilter;
    candidateIds?: number[];
  }): Promise<{ professionals: HealthcareProfessionalRecord[]; total: number }> {
    const conditions = [isNull(persons.deletedAt)];

    if (params.candidateIds) {
      conditions.push(inArray(persons.id, params.candidateIds));
    }

    if (!params.scope.isGlobal) {
      const facilityIds = params.scope.facilityIds?.length
        ? params.scope.facilityIds
        : [-1];
      conditions.push(inArray(persons.id, scopedPersonIdsSubquery(facilityIds)));
    }

    if (params.facilityId) {
      conditions.push(
        inArray(persons.id, scopedPersonIdsSubquery([params.facilityId]))
      );
    }

    if (params.specialty) {
      const specialtyValues = parseSpecialtyFilterValues(params.specialty);
      if (specialtyValues.length > 0) {
        // Matches any specialty the professional holds, primary or not. It was
        // restricted to `is_primary = true`, so filtering for Ortopedia hid
        // every doctor who practises it as a secondary specialty — invisible
        // from the outside, since the results looked like a plausible list.
        conditions.push(
          sql`exists (
            select 1
            from person_healthcare_profile_specialties phps
            inner join healthcare_specialties hs on hs.id = phps.specialty_id
            where phps.person_id = ${persons.id}
              and regexp_replace(
                trim(translate(lower(hs.name),
                  'áàâãäéèêëíìîïóòôõöúùûüç' || chr(768) || chr(769) || chr(770) || chr(771) || chr(776) || chr(807),
                  'aaaaaeeeeiiiiooooouuuuc')),
                '[[:space:]]+', ' ', 'g'
              ) in (${sql.join(
                specialtyValues.map((value) => sql`${value}`),
                sql`, `
              )})
          )`
        );
      }
    }

    const scopedFacilityIds = params.scope.isGlobal
      ? undefined
      : params.scope.facilityIds?.length
        ? params.scope.facilityIds
        : [-1];
    const distanceScope = scopedFacilityIds
      ? sql` and pf.facility_id in (${sql.join(
          scopedFacilityIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      : sql``;
    const referencePoint =
      params.latitude === undefined
        ? undefined
        : sql`ST_SetSRID(ST_MakePoint(${params.longitude!}, ${params.latitude}), 4326)`;
    const distanceKm = referencePoint
      ? sql<number>`(select min(ST_Distance(f.location::geography, ${referencePoint}::geography) / 1000)
          from person_facilities pf
          inner join facilities f on f.id = pf.facility_id
          where pf.person_id = ${sql.raw('"persons"."id"')}
            and pf.ended_at is null
            and f.deactivated_at is null
            and f.location is not null${distanceScope})`
      : undefined;

    if (referencePoint) {
      const proximityConditions = [
        isNull(personFacilities.endedAt),
        isNull(facilities.deactivatedAt),
        sql`${facilities.location} IS NOT NULL`,
        ...(scopedFacilityIds
          ? [inArray(personFacilities.facilityId, scopedFacilityIds)]
          : []),
        ...(params.radiusKm === undefined
          ? []
          : [
              sql`ST_DWithin(${facilities.location}::geography, ${referencePoint}::geography, ${params.radiusKm * 1000})`,
            ]),
      ];
      conditions.push(
        inArray(
          persons.id,
          db
            .select({ personId: personFacilities.personId })
            .from(personFacilities)
            .innerJoin(facilities, eq(facilities.id, personFacilities.facilityId))
            .where(and(...proximityConditions))
        )
      );
    }

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(persons.firstName, pattern),
          ilike(persons.lastName, pattern),
          ilike(persons.socialName, pattern),
          ilike(persons.cpf, pattern),
          sql`exists (
            select 1 from person_professional_registrations ppr
            where ppr.person_id = ${persons.id}
              and ppr.registration_number ilike ${pattern}
          )`,
          sql`exists (
            select 1
            from person_healthcare_profile_specialties phps
            inner join healthcare_specialties hs on hs.id = phps.specialty_id
            where phps.person_id = ${persons.id}
              and hs.name ilike ${pattern}
          )`
        )!
      );
    }

    const where = and(...conditions);
    const skip = (params.page - 1) * params.limit;

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          socialName: persons.socialName,
          cpf: persons.cpf,
          createdAt: persons.createdAt,
          updatedAt: persons.updatedAt,
          distanceKm: distanceKm ?? sql<number | null>`null`,
        })
        .from(persons)
        .innerJoin(
          personHealthcareProfiles,
          eq(personHealthcareProfiles.personId, persons.id)
        )
        .where(where)
        .orderBy(
          ...(distanceKm && params.sort !== "name"
            ? [asc(distanceKm), asc(persons.lastName), asc(persons.firstName)]
            : buildOrderBy(params))
        )
        .offset(skip)
        .limit(params.limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(persons)
        .innerJoin(
          personHealthcareProfiles,
          eq(personHealthcareProfiles.personId, persons.id)
        )
        .where(where),
    ]);

    const visibleFacilityIds = params.scope.isGlobal
      ? undefined
      : params.scope.facilityIds?.length
        ? params.scope.facilityIds
        : [-1];
    const personIds = rows.map((row) => row.id);
    const [associationsMap, enrichmentMap, primaryRegistrationMap] =
      await Promise.all([
        loadAssociationsMap(personIds, visibleFacilityIds),
        loadEnrichmentMap(personIds),
        loadPrimaryRegistrationDisplayMap(personIds),
      ]);

    return {
      professionals: rows.map((row) =>
        mapRecord(
          row,
          enrichmentMap.get(row.id) ?? { specialty: null },
          associationsMap.get(row.id) ?? [],
          primaryRegistrationMap.get(row.id) ?? null
        )
      ),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findAllByIds(params: {
    ids: number[];
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: HealthcareProfessionalListScopeFilter;
  }): Promise<HealthcareProfessionalRecord[]> {
    if (params.ids.length === 0) return [];

    const { professionals } = await this.findAll({
      ...params,
      page: 1,
      limit: params.ids.length,
      candidateIds: params.ids,
    });
    return professionals;
  }
}

export type { HealthcareProfessionalFacilitySummary };
