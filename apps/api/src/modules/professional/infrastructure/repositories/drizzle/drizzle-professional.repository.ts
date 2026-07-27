import {
  professionals,
  professionalNotes,
  facilityProfessionals,
  facilities,
} from "@atlasmed/database";
import { eq, and, or, isNull, isNotNull, ilike, inArray, sql, asc, desc, getTableColumns } from "drizzle-orm";
import { normalizeSearchFilterValue } from "@atlasmed/cnes-ingestion";
import { db } from "../../../../../infrastructure/database/db";
import { ResourceNotFoundError } from "../../../../../shared/errors";
import type {
  ProfessionalCreateInput,
  ProfessionalFacilitySummary,
  ProfessionalListScopeFilter,
  ProfessionalNoteRecord,
  ProfessionalRecord,
  ProfessionalRepository,
  ProfessionalSourceUpsertInput,
  ProfessionalUpdateInput,
} from "../../../application/interfaces/professional.repository.interface";

type ProfessionalRow = typeof professionals.$inferSelect;

function resolveFullName(
  firstName: string,
  lastName: string,
  fullName?: string | null
): string {
  return fullName?.trim() || `${firstName} ${lastName}`.trim();
}

function mapProfessional(
  professional: ProfessionalRow,
  facilityAssociations: Array<{ facilityId: string; endedAt: Date | null }>
): ProfessionalRecord {
  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName: professional.fullName,
    socialName: professional.socialName,
    taxId: professional.taxId,
    birthDate: professional.birthDate,
    mobilePhone: professional.mobilePhone,
    landlinePhone: professional.landlinePhone,
    email: professional.email,
    websiteUrl: professional.websiteUrl,
    imageUrl: professional.imageUrl,
    favoriteTeam: professional.favoriteTeam,
    favoriteSport: professional.favoriteSport,
    languages: professional.languages,
    hobbies: professional.hobbies,
    notes: professional.notes,
    specialty: professional.primarySpecialtyLabel,
    crmCouncil: professional.crmCouncil,
    crmNumber: professional.crmNumber,
    crmState: professional.crmState,
    sourceProvider: professional.sourceProvider,
    externalSourceId: professional.externalSourceId,
    sourceContentHash: professional.sourceContentHash,
    sourceFirstSeenAt: professional.sourceFirstSeenAt,
    sourceLastSeenAt: professional.sourceLastSeenAt,
    sourcePresent: professional.sourcePresent,
    sourceTracked: professional.sourceTracked,
    manuallyEditedAt: professional.manuallyEditedAt,
    facilityIds: facilityAssociations
      .filter((a) => a.endedAt === null)
      .map((a) => a.facilityId),
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt,
    deletedAt: professional.deletedAt,
  };
}

async function loadAssociationsMap(
  professionalIds: string[]
): Promise<Map<string, Array<{ facilityId: string; endedAt: Date | null }>>> {
  if (professionalIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      professionalId: facilityProfessionals.professionalId,
      facilityId: facilityProfessionals.facilityId,
      endedAt: facilityProfessionals.endedAt,
    })
    .from(facilityProfessionals)
    .innerJoin(facilities, eq(facilities.id, facilityProfessionals.facilityId))
    .where(
      and(
        inArray(facilityProfessionals.professionalId, professionalIds),
        isNull(facilities.deactivatedAt)
      )
    );

  const map = new Map<string, Array<{ facilityId: string; endedAt: Date | null }>>();
  for (const row of rows) {
    if (!map.has(row.professionalId)) map.set(row.professionalId, []);
    map.get(row.professionalId)!.push({ facilityId: row.facilityId, endedAt: row.endedAt });
  }
  return map;
}

async function loadAssociationsForOne(
  professionalId: string
): Promise<Array<{ facilityId: string; endedAt: Date | null }>> {
  const map = await loadAssociationsMap([professionalId]);
  return map.get(professionalId) ?? [];
}

function buildPersonCreateData(data: ProfessionalCreateInput) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: resolveFullName(data.firstName, data.lastName, data.fullName),
    socialName: data.socialName ?? null,
    taxId: data.taxId ?? null,
    birthDate: data.birthDate ?? null,
    mobilePhone: data.mobilePhone ?? null,
    landlinePhone: data.landlinePhone ?? null,
    email: data.email ?? null,
    websiteUrl: data.websiteUrl ?? null,
    imageUrl: data.imageUrl ?? null,
    favoriteTeam: data.favoriteTeam ?? null,
    favoriteSport: data.favoriteSport ?? null,
    languages: data.languages ?? null,
    hobbies: data.hobbies ?? null,
    notes: data.notes ?? null,
    primarySpecialtyLabel: data.specialty ?? null,
    crmCouncil: data.crmCouncil ?? null,
    crmNumber: data.crmNumber ?? null,
    crmState: data.crmState ?? null,
  };
}

function buildPersonUpdateData(data: ProfessionalUpdateInput) {
  const patch: Partial<typeof professionals.$inferInsert> = {};

  if (data.firstName !== undefined) patch.firstName = data.firstName;
  if (data.lastName !== undefined) patch.lastName = data.lastName;
  if (data.fullName !== undefined) patch.fullName = data.fullName;
  if (data.socialName !== undefined) patch.socialName = data.socialName;
  if (data.taxId !== undefined) patch.taxId = data.taxId;
  if (data.birthDate !== undefined) patch.birthDate = data.birthDate;
  if (data.mobilePhone !== undefined) patch.mobilePhone = data.mobilePhone;
  if (data.landlinePhone !== undefined) patch.landlinePhone = data.landlinePhone;
  if (data.email !== undefined) patch.email = data.email;
  if (data.websiteUrl !== undefined) patch.websiteUrl = data.websiteUrl;
  if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl;
  if (data.favoriteTeam !== undefined) patch.favoriteTeam = data.favoriteTeam;
  if (data.favoriteSport !== undefined) patch.favoriteSport = data.favoriteSport;
  if (data.languages !== undefined) patch.languages = data.languages;
  if (data.hobbies !== undefined) patch.hobbies = data.hobbies;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.specialty !== undefined) patch.primarySpecialtyLabel = data.specialty;
  if (data.crmCouncil !== undefined) patch.crmCouncil = data.crmCouncil;
  if (data.crmNumber !== undefined) patch.crmNumber = data.crmNumber;
  if (data.crmState !== undefined) patch.crmState = data.crmState;
  if (data.manuallyEditedAt !== undefined) patch.manuallyEditedAt = data.manuallyEditedAt;

  return patch;
}

function buildProfessionalListOrderBy(params: { order?: "asc" | "desc" }) {
  const direction = params.order === "desc" ? desc : asc;
  return [direction(professionals.lastName), direction(professionals.firstName)];
}

export class DrizzleProfessionalRepository implements ProfessionalRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    sort?: string;
    order?: "asc" | "desc";
    scope: ProfessionalListScopeFilter;
    candidateIds?: string[];
  }): Promise<{ professionals: ProfessionalRecord[]; total: number }> {
    const conditions = [isNull(professionals.deletedAt)];

    if (params.candidateIds) {
      conditions.push(inArray(professionals.id, params.candidateIds));
    }

    if (!params.scope.isGlobal) {
      const facilityIds = params.scope.facilityIds?.length
        ? params.scope.facilityIds
        : ["__none__"];

      conditions.push(
        inArray(
          professionals.id,
          db
            .select({ id: facilityProfessionals.professionalId })
            .from(facilityProfessionals)
            .innerJoin(facilities, eq(facilities.id, facilityProfessionals.facilityId))
            .where(
              and(
                inArray(facilityProfessionals.facilityId, facilityIds),
                isNull(facilityProfessionals.endedAt),
                isNull(facilities.deactivatedAt)
              )
            )
        )
      );
    }

    if (params.facilityId) {
      conditions.push(
        inArray(
          professionals.id,
          db
            .select({ id: facilityProfessionals.professionalId })
            .from(facilityProfessionals)
            .innerJoin(facilities, eq(facilities.id, facilityProfessionals.facilityId))
            .where(
              and(
                eq(facilityProfessionals.facilityId, params.facilityId),
                isNull(facilityProfessionals.endedAt),
                isNull(facilities.deactivatedAt)
              )
            )
        )
      );
    }

    if (params.specialty) {
      const normalizedSpecialty = normalizeSearchFilterValue(params.specialty);
      conditions.push(
        sql`regexp_replace(trim(translate(lower(${professionals.primarySpecialtyLabel}), 'áàâãäéèêëíìîïóòôõöúùûüç' || chr(768) || chr(769) || chr(770) || chr(771) || chr(776) || chr(807), 'aaaaaeeeeiiiiooooouuuuc')), '[[:space:]]+', ' ', 'g') = ${normalizedSpecialty}`
      );
    }

    // Distances and radius eligibility are calculated only from facilities visible
    // through the active scope. An association outside scope cannot affect a result.
    const scopedFacilityIds = params.scope.isGlobal
      ? undefined
      : (params.scope.facilityIds?.length ? params.scope.facilityIds : ["__none__"]);
    const distanceScope = scopedFacilityIds
      ? sql` and fp.facility_id in (${sql.join(scopedFacilityIds.map((id) => sql`${id}`), sql`, `)})`
      : sql``;
    const referencePoint = params.latitude === undefined ? undefined : sql`ST_SetSRID(ST_MakePoint(${params.longitude!}, ${params.latitude}), 4326)`;
    // Qualify outer professionals.id explicitly. Drizzle interpolates ${professionals.id}
    // as bare "id" in SELECT subqueries, which Postgres rejects as ambiguous vs facilities.id.
    const distanceKm = referencePoint
      ? sql<number>`(select min(ST_Distance(f.location::geography, ${referencePoint}::geography) / 1000)
          from facility_professionals fp
          inner join facilities f on f.id = fp.facility_id
          where fp.professional_id = ${sql.raw('"professionals"."id"')} and fp.ended_at is null and f.deactivated_at is null and f.location is not null${distanceScope})`
      : undefined;
    if (referencePoint) {
      const proximityConditions = [
        isNull(facilityProfessionals.endedAt),
        isNull(facilities.deactivatedAt),
        sql`${facilities.location} IS NOT NULL`,
        ...(scopedFacilityIds ? [inArray(facilityProfessionals.facilityId, scopedFacilityIds)] : []),
        ...(params.radiusKm === undefined ? [] : [sql`ST_DWithin(${facilities.location}::geography, ${referencePoint}::geography, ${params.radiusKm * 1000})`]),
      ];
      conditions.push(inArray(professionals.id, db
        .select({ professionalId: facilityProfessionals.professionalId })
        .from(facilityProfessionals)
        .innerJoin(facilities, eq(facilities.id, facilityProfessionals.facilityId))
        .where(and(...proximityConditions))));
    }

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(professionals.firstName, pattern),
          ilike(professionals.lastName, pattern),
          ilike(professionals.fullName, pattern),
          ilike(professionals.primarySpecialtyLabel, pattern),
          ilike(professionals.taxId, pattern),
          ilike(professionals.crmNumber, pattern),
        )!
      );
    }

    const where = and(...conditions);
    const skip = (params.page - 1) * params.limit;

    const [rows, countRows] = await Promise.all([
      db
        .select({ ...getTableColumns(professionals), distanceKm: distanceKm ?? sql<number | null>`null` })
        .from(professionals)
        .where(where)
        .orderBy(...(distanceKm && params.sort !== "name" ? [asc(distanceKm), asc(professionals.lastName), asc(professionals.firstName)] : buildProfessionalListOrderBy(params)))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)::int` }).from(professionals).where(where),
    ]);

    const associationsMap = await loadAssociationsMap(rows.map((p) => p.id));

    return {
      professionals: rows.map((p) => ({
        ...mapProfessional(p, associationsMap.get(p.id) ?? []),
        distanceKm: p.distanceKm ?? null,
      })),
      total: countRows[0]?.count ?? 0,
    };
  }

  async listDistinctSpecialties(scope: ProfessionalListScopeFilter): Promise<string[]> {
    const conditions = [
      isNull(professionals.deletedAt),
      isNotNull(professionals.primarySpecialtyLabel),
      sql`trim(${professionals.primarySpecialtyLabel}) <> ''`,
    ];

    if (!scope.isGlobal) {
      const facilityIds = scope.facilityIds?.length ? scope.facilityIds : ["__none__"];
      conditions.push(
        inArray(
          professionals.id,
          db
            .select({ id: facilityProfessionals.professionalId })
            .from(facilityProfessionals)
            .innerJoin(facilities, eq(facilities.id, facilityProfessionals.facilityId))
            .where(
              and(
                inArray(facilityProfessionals.facilityId, facilityIds),
                isNull(facilityProfessionals.endedAt),
                isNull(facilities.deactivatedAt)
              )
            )
        )
      );
    }

    const rows = await db
      .selectDistinct({ specialty: professionals.primarySpecialtyLabel })
      .from(professionals)
      .where(and(...conditions))
      .orderBy(asc(professionals.primarySpecialtyLabel));

    return rows
      .map((row) => row.specialty?.trim() ?? "")
      .filter((specialty) => specialty.length > 0);
  }

  async findAllByIds(params: {
    ids: string[];
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ProfessionalListScopeFilter;
  }): Promise<ProfessionalRecord[]> {
    if (params.ids.length === 0) {
      return [];
    }

    const { professionals } = await this.findAll({
      ...params,
      page: 1,
      limit: params.ids.length,
      candidateIds: params.ids,
    });
    return professionals;
  }

  async findById(id: string): Promise<ProfessionalRecord | null> {
    const [professional] = await db
      .select()
      .from(professionals)
      .where(and(eq(professionals.id, id), isNull(professionals.deletedAt)))
      .limit(1);

    if (!professional) return null;

    const associations = await loadAssociationsForOne(professional!.id);
    return mapProfessional(professional!, associations);
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ProfessionalRecord | null> {
    const [professional] = await db
      .select()
      .from(professionals)
      .where(
        and(
          eq(professionals.sourceProvider, sourceProvider),
          eq(professionals.externalSourceId, externalSourceId),
          isNull(professionals.deletedAt)
        )
      )
      .limit(1);

    if (!professional) return null;

    const associations = await loadAssociationsForOne(professional!.id);
    return mapProfessional(professional!, associations);
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<ProfessionalRecord[]> {
    const rows = await db
      .select()
      .from(professionals)
      .where(
        and(
          eq(professionals.sourceProvider, sourceProvider),
          eq(professionals.sourceTracked, true),
          isNull(professionals.deletedAt)
        )
      );

    const associationsMap = await loadAssociationsMap(rows.map((p) => p.id));

    return rows.map((p) => mapProfessional(p, associationsMap.get(p.id) ?? []));
  }

  async findActiveFacilities(professionalId: string): Promise<ProfessionalFacilitySummary[]> {
    const rows = await db
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
      })
      .from(facilityProfessionals)
      .innerJoin(facilities, eq(facilityProfessionals.facilityId, facilities.id))
      .where(
        and(
          eq(facilityProfessionals.professionalId, professionalId),
          isNull(facilityProfessionals.endedAt),
          isNull(facilities.deactivatedAt)
        )
      )
      .orderBy(asc(facilities.displayName));

    return rows.map((row) => ({
      id: row.id,
      name:
        row.displayName?.trim() ||
        row.tradeName?.trim() ||
        row.legalName?.trim() ||
        row.id,
    }));
  }

  async findNotesByProfessionalAndUser(
    professionalId: string,
    userId: string
  ): Promise<ProfessionalNoteRecord[]> {
    return db
      .select()
      .from(professionalNotes)
      .where(
        and(
          eq(professionalNotes.professionalId, professionalId),
          eq(professionalNotes.userId, userId)
        )
      )
      .orderBy(desc(professionalNotes.createdAt));
  }

  async createNote(input: {
    professionalId: string;
    userId: string;
    note: string;
  }): Promise<ProfessionalNoteRecord> {
    const [note] = await db.insert(professionalNotes).values(input).returning();
    return note!;
  }

  async create(data: ProfessionalCreateInput): Promise<ProfessionalRecord> {
    const now = new Date();

    const [professional] = await db
      .insert(professionals)
      .values(buildPersonCreateData(data))
      .returning();

    if (data.facilityIds.length > 0) {
      await db.insert(facilityProfessionals).values(
        data.facilityIds.map((facilityId) => ({
          facilityId,
          professionalId: professional!.id,
          occupationCode: "LEGACY",
          confirmedAt: now,
          confirmedByUserId: data.confirmedByUserId ?? null,
        }))
      );
    }

    const associations = await loadAssociationsForOne(professional!.id);
    return mapProfessional(professional!, associations);
  }

  async update(id: string, data: ProfessionalUpdateInput): Promise<ProfessionalRecord> {
    const [existing] = await db
      .select({
        firstName: professionals.firstName,
        lastName: professionals.lastName,
        fullName: professionals.fullName,
      })
      .from(professionals)
      .where(eq(professionals.id, id))
      .limit(1);

    if (!existing) throw new ResourceNotFoundError("Professional", id);

    const patch = buildPersonUpdateData(data);

    if (
      data.fullName === undefined &&
      (data.firstName !== undefined || data.lastName !== undefined)
    ) {
      patch.fullName = resolveFullName(
        data.firstName ?? existing.firstName,
        data.lastName ?? existing.lastName,
        existing.fullName
      );
    }

    const [professional] = await db
      .update(professionals)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(professionals.id, id))
      .returning();

    const associations = await loadAssociationsForOne(professional!.id);
    return mapProfessional(professional!, associations);
  }

  async softDelete(id: string): Promise<void> {
    await db
      .update(professionals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(professionals.id, id));
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await db
      .update(professionals)
      .set({ sourcePresent: false, sourceLastSeenAt, updatedAt: new Date() })
      .where(eq(professionals.id, id));
  }

  async upsertFromSource(input: ProfessionalSourceUpsertInput): Promise<{
    professional: ProfessionalRecord;
    created: boolean;
    updated: boolean;
  }> {
    const [existing] = await db
      .select()
      .from(professionals)
      .where(
        and(
          eq(professionals.sourceProvider, input.sourceProvider),
          eq(professionals.externalSourceId, input.externalSourceId)
        )
      )
      .limit(1);

    const sourcePersonFields = {
      firstName: input.firstName,
      lastName: input.lastName,
      fullName:
        input.fullName?.trim() || resolveFullName(input.firstName, input.lastName, null),
      socialName: input.socialName ?? null,
      taxId: input.taxId ?? null,
      primarySpecialtyLabel: input.specialty,
      crmCouncil: input.crmCouncil ?? null,
      crmNumber: input.crmNumber ?? null,
      crmState: input.crmState ?? null,
    };

    if (!existing) {
      const [professional] = await db
        .insert(professionals)
        .values({
          ...sourcePersonFields,
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        })
        .returning();

      const associations = await loadAssociationsForOne(professional!.id);
      return {
        professional: mapProfessional(professional!, associations),
        created: true,
        updated: false,
      };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;

    const updateData: Partial<typeof professionals.$inferInsert> & { updatedAt: Date } = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
      updatedAt: new Date(),
    };

    if (!existing.manuallyEditedAt) {
      Object.assign(updateData, sourcePersonFields);
    }

    const [professional] = await db
      .update(professionals)
      .set(updateData)
      .where(eq(professionals.id, existing.id))
      .returning();

    const associations = await loadAssociationsForOne(professional!.id);
    return {
      professional: mapProfessional(professional!, associations),
      created: false,
      updated: !hashUnchanged || !existing.manuallyEditedAt,
    };
  }

  async findExistingFacilityIds(facilityIds: string[]): Promise<string[]> {
    if (facilityIds.length === 0) return [];

    const rows = await db
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(inArray(facilities.id, facilityIds), isNull(facilities.deactivatedAt)));

    return rows.map((r) => r.id);
  }
}
