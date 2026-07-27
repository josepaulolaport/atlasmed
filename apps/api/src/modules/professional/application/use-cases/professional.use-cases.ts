import type { ScopeContext } from "@atlasmed/access";
import type { ProfessionalProfile } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { RELATIONSHIP_LEVEL_MAX } from "@atlasmed/database";
import { normalizeSearchFilterValue } from "@atlasmed/cnes-ingestion";
import { buildMeiliFilter, eqFilter, inFilter } from "../../../../infrastructure/search/meili-filter";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../shared/errors";
type SearchService = {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: { limit: number; offset: number; filter?: string; sort?: string[] }
  ): Promise<{ hits: T[]; estimatedTotalHits?: number }>;
};

function orderSearchResultsById<T extends { id: string }>(records: T[], ids: string[]): T[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = recordsById.get(id);
    return record ? [record] : [];
  });
}
import type {
  ProfessionalCreateInput,
  ProfessionalNoteRecord,
  ProfessionalRecord,
  ProfessionalRepository,
  ProfessionalUpdateInput,
} from "../interfaces/professional.repository.interface";
import type { UserProfessionalRelationshipRepository } from "../interfaces/user-professional-relationship.repository.interface";

function formatDate(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

function facilitiesInScope(
  facilities: Array<{ id: string; name: string }>,
  scope: ScopeContext
): Array<{ id: string; name: string }> {
  if (scope.isGlobal) {
    return facilities;
  }

  const allowed = new Set(scope.facilityIds);
  return facilities.filter((facility) => allowed.has(facility.id));
}

async function serializeProfessionalProfile(
  professional: ProfessionalRecord,
  repository: ProfessionalRepository,
  scope: ScopeContext
): Promise<ProfessionalProfile> {
  const allFacilities = await repository.findActiveFacilities(professional.id);
  const facilities = facilitiesInScope(allFacilities, scope);

  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName: professional.fullName ?? undefined,
    socialName: professional.socialName ?? undefined,
    taxId: professional.taxId ?? undefined,
    birthDate: formatDate(professional.birthDate),
    mobilePhone: professional.mobilePhone ?? undefined,
    landlinePhone: professional.landlinePhone ?? undefined,
    email: professional.email ?? undefined,
    websiteUrl: professional.websiteUrl ?? undefined,
    imageUrl: professional.imageUrl ?? undefined,
    imageBlurhash: professional.imageBlurhash ?? undefined,
    primarySpecialtyLabel: professional.specialty ?? undefined,
    specialty: professional.specialty ?? undefined,
    crmCouncil: professional.crmCouncil ?? undefined,
    crmNumber: professional.crmNumber ?? undefined,
    crmState: professional.crmState ?? undefined,
    favoriteTeam: professional.favoriteTeam ?? undefined,
    favoriteSport: professional.favoriteSport ?? undefined,
    languages: professional.languages ?? undefined,
    hobbies: professional.hobbies ?? undefined,
    notes: professional.notes ?? undefined,
    facilityIds: facilities.map((facility) => facility.id),
    facilities,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

function serializeProfessionalSummary(
  professional: ProfessionalRecord,
  relationshipLevel?: number
) {
  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName: professional.fullName ?? undefined,
    specialty: professional.specialty ?? undefined,
    primarySpecialtyLabel: professional.specialty ?? undefined,
    crmNumber: professional.crmNumber ?? undefined,
    crmState: professional.crmState ?? undefined,
    facilityIds: professional.facilityIds,
    displayFacility: professional.displayFacility ?? undefined,
    relationshipLevel,
    isPriority: relationshipLevel === RELATIONSHIP_LEVEL_MAX,
    distanceKm: professional.distanceKm ?? undefined,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

function assertFacilityIdsInScope(scope: ScopeContext, facilityIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  for (const facilityId of facilityIds) {
    assertResourceInScope(scope, "facility", facilityId);
  }
}

function assertProfessionalAccessible(scope: ScopeContext, facilityIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  const hasAccessibleFacility = facilityIds.some((facilityId) =>
    scope.facilityIds.includes(facilityId)
  );

  if (!hasAccessibleFacility) {
    throw new ForbiddenError("Professional outside scope");
  }
}

function serializeProfessionalNote(note: ProfessionalNoteRecord) {
  return {
    id: note.id,
    note: note.note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function getAccessibleProfessional(
  repository: ProfessionalRepository,
  professionalId: string,
  scope: ScopeContext
): Promise<ProfessionalRecord> {
  const professional = await repository.findById(professionalId);

  if (!professional) {
    throw new ResourceNotFoundError("Professional", professionalId);
  }

  assertProfessionalAccessible(scope, professional.facilityIds);
  return professional;
}

function parseBirthDate(value?: string | null): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function buildCreateInput(input: {
  firstName: string;
  lastName: string;
  fullName?: string;
  socialName?: string;
  taxId?: string;
  birthDate?: string;
  mobilePhone?: string;
  landlinePhone?: string;
  email?: string;
  websiteUrl?: string;
  imageUrl?: string;
  primarySpecialtyLabel?: string;
  specialty?: string;
  crmCouncil?: string;
  crmNumber?: string;
  crmState?: string;
  favoriteTeam?: string;
  favoriteSport?: string;
  languages?: string;
  hobbies?: string;
  notes?: string;
  facilityIds?: string[];
}): ProfessionalCreateInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.fullName ?? null,
    socialName: input.socialName ?? null,
    taxId: input.taxId ?? null,
    birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null,
    mobilePhone: input.mobilePhone ?? null,
    landlinePhone: input.landlinePhone ?? null,
    email: input.email ?? null,
    websiteUrl: input.websiteUrl ?? null,
    imageUrl: input.imageUrl ?? null,
    specialty: input.primarySpecialtyLabel ?? input.specialty ?? null,
    crmCouncil: input.crmCouncil ?? null,
    crmNumber: input.crmNumber ?? null,
    crmState: input.crmState ?? null,
    favoriteTeam: input.favoriteTeam ?? null,
    favoriteSport: input.favoriteSport ?? null,
    languages: input.languages ?? null,
    hobbies: input.hobbies ?? null,
    notes: input.notes ?? null,
    facilityIds: input.facilityIds ?? [],
  };
}

function buildUpdateInput(input: {
  firstName?: string;
  lastName?: string;
  fullName?: string | null;
  socialName?: string | null;
  taxId?: string | null;
  birthDate?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  primarySpecialtyLabel?: string | null;
  specialty?: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
  hobbies?: string | null;
  notes?: string | null;
}): ProfessionalUpdateInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.fullName,
    socialName: input.socialName,
    taxId: input.taxId,
    birthDate: parseBirthDate(input.birthDate),
    mobilePhone: input.mobilePhone,
    landlinePhone: input.landlinePhone,
    email: input.email,
    websiteUrl: input.websiteUrl,
    imageUrl: input.imageUrl,
    specialty:
      input.primarySpecialtyLabel !== undefined
        ? input.primarySpecialtyLabel
        : input.specialty,
    crmCouncil: input.crmCouncil,
    crmNumber: input.crmNumber,
    crmState: input.crmState,
    favoriteTeam: input.favoriteTeam,
    favoriteSport: input.favoriteSport,
    languages: input.languages,
    hobbies: input.hobbies,
    notes: input.notes,
    manuallyEditedAt: new Date(),
  };
}

interface Dependencies {
  doctorRepository: ProfessionalRepository;
  searchService?: SearchService;
}

interface ListProfessionalsDependencies extends Dependencies {
  userProfessionalRelationshipRepository?: UserProfessionalRelationshipRepository;
}

export class ListProfessionalSpecialtiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { scope: ScopeContext }): Promise<{ data: string[] }> {
    const scope = input.scope.isGlobal
      ? { isGlobal: true as const }
      : { isGlobal: false as const, facilityIds: input.scope.facilityIds };

    const data = await this.deps.doctorRepository.listDistinctSpecialties(scope);
    return { data };
  }
}

export class ListProfessionalsUseCase {
  constructor(private readonly deps: ListProfessionalsDependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    userId?: string;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const scope = input.scope.isGlobal
      ? { isGlobal: true as const }
      : { isGlobal: false as const, facilityIds: input.scope.facilityIds };
    const search = input.search?.trim();

    if (!search) {
      const { professionals, total } = await this.deps.doctorRepository.findAll({
        page,
        limit,
        search: input.search,
        facilityId: input.facilityId,
        specialty: input.specialty,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        scope,
      });

      const relationshipLevels =
        input.userId && this.deps.userProfessionalRelationshipRepository
          ? await this.deps.userProfessionalRelationshipRepository.findLevelsByUserAndProfessionals(
              input.userId,
              professionals.map((professional) => professional.id)
            )
          : new Map<string, number>();

      return {
        data: professionals.map((professional) =>
          serializeProfessionalSummary(
            professional,
            relationshipLevels.get(professional.id)
          )
        ),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      throw new ServiceUnavailableError("Search");
    }

    let result: { hits: Array<{ id: string }>; estimatedTotalHits?: number };
    try {
      const canonicalFilters = [
        input.specialty
          ? eqFilter("specialtyNormalized", normalizeSearchFilterValue(input.specialty))
          : undefined,
        input.facilityId ? eqFilter("activeFacilityIds", input.facilityId) : undefined,
      ];
      const scopeFilter = input.scope.isGlobal
        ? undefined
        : input.scope.facilityIds.length > 0
          ? inFilter("activeFacilityIds", input.scope.facilityIds)
          : eqFilter("activeFacilityIds", "__none__");
      const filter = buildMeiliFilter([...canonicalFilters, scopeFilter])
        ?? buildMeiliFilter(canonicalFilters);
      result = await searchService.search<{ id: string }>("professionals", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
      });
    } catch (error) {
      throw new ServiceUnavailableError("Search", error instanceof Error ? error : undefined);
    }

    const ids = result.hits.map((hit) => hit.id);
    const professionals = ids.length
      ? orderSearchResultsById(
          await this.deps.doctorRepository.findAllByIds({
            ids,
            facilityId: input.facilityId,
            specialty: input.specialty,
            latitude: input.latitude,
            longitude: input.longitude,
            radiusKm: input.radiusKm,
            scope,
          }),
          ids
        )
      : [];
    const total = result.estimatedTotalHits ?? 0;
    const relationshipLevels =
      input.userId && this.deps.userProfessionalRelationshipRepository
        ? await this.deps.userProfessionalRelationshipRepository.findLevelsByUserAndProfessionals(
            input.userId,
            professionals.map((professional) => professional.id)
          )
        : new Map<string, number>();

    return {
      data: professionals.map((professional) =>
        serializeProfessionalSummary(
          professional,
          relationshipLevels.get(professional.id)
        )
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetProfessionalUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { professionalId: string; scope: ScopeContext }) {
    const professional = await this.deps.doctorRepository.findById(input.professionalId);

    if (!professional) {
      return null;
    }

    assertProfessionalAccessible(input.scope, professional.facilityIds);

    return serializeProfessionalProfile(
      professional,
      this.deps.doctorRepository,
      input.scope
    );
  }
}

export class ListProfessionalNotesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { professionalId: string; userId: string; scope: ScopeContext }) {
    await getAccessibleProfessional(
      this.deps.doctorRepository,
      input.professionalId,
      input.scope
    );

    const notes = await this.deps.doctorRepository.findNotesByProfessionalAndUser(
      input.professionalId,
      input.userId
    );

    return notes.map(serializeProfessionalNote);
  }
}

export class CreateProfessionalNoteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    professionalId: string;
    userId: string;
    note: string;
    scope: ScopeContext;
  }) {
    await getAccessibleProfessional(
      this.deps.doctorRepository,
      input.professionalId,
      input.scope
    );

    return serializeProfessionalNote(
      await this.deps.doctorRepository.createNote({
        professionalId: input.professionalId,
        userId: input.userId,
        note: input.note,
      })
    );
  }
}

export class CreateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    input: Parameters<typeof buildCreateInput>[0] & { scope: ScopeContext }
  ) {
    const facilityIds = input.facilityIds ?? [];

    if (facilityIds.length > 0) {
      assertFacilityIdsInScope(input.scope, facilityIds);

      const existingFacilityIds = await this.deps.doctorRepository.findExistingFacilityIds(
        facilityIds
      );

      if (existingFacilityIds.length !== facilityIds.length) {
        throw new ResourceNotFoundError("Facility", "one or more facilityIds");
      }
    }

    const professional = await this.deps.doctorRepository.create(
      buildCreateInput(input)
    );

    return serializeProfessionalProfile(
      professional,
      this.deps.doctorRepository,
      input.scope
    );
  }
}

export class UpdateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(
    input: {
      professionalId: string;
      scope: ScopeContext;
      facilityIds?: string[];
    } & Parameters<typeof buildUpdateInput>[0]
  ) {
    const existing = await this.deps.doctorRepository.findById(input.professionalId);

    if (!existing) {
      return null;
    }

    assertProfessionalAccessible(input.scope, existing.facilityIds);

    if (input.facilityIds) {
      throw new ValidationError([
        {
          field: "facilityIds",
          message:
            "Use facility association endpoints to manage facility-professional links",
        },
      ]);
    }

    const professional = await this.deps.doctorRepository.update(
      input.professionalId,
      buildUpdateInput(input)
    );

    return serializeProfessionalProfile(
      professional,
      this.deps.doctorRepository,
      input.scope
    );
  }
}

export class DeleteDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { professionalId: string; scope: ScopeContext }) {
    const existing = await this.deps.doctorRepository.findById(input.professionalId);

    if (!existing) {
      return false;
    }

    assertProfessionalAccessible(input.scope, existing.facilityIds);

    await this.deps.doctorRepository.softDelete(input.professionalId);
    return true;
  }
}
