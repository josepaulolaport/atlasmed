import type { ScopeContext } from "@atlasmed/access";
import type { ProfessionalProfile } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  ProfessionalCreateInput,
  ProfessionalRecord,
  ProfessionalRepository,
  ProfessionalUpdateInput,
} from "../interfaces/professional.repository.interface";

function formatDate(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

async function serializeProfessionalProfile(
  professional: ProfessionalRecord,
  repository: ProfessionalRepository
): Promise<ProfessionalProfile> {
  const facilities = await repository.findActiveFacilities(professional.id);

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
    primarySpecialtyLabel: professional.specialty ?? undefined,
    specialty: professional.specialty ?? undefined,
    crmCouncil: professional.crmCouncil ?? undefined,
    crmNumber: professional.crmNumber ?? undefined,
    crmState: professional.crmState ?? undefined,
    favoriteTeam: professional.favoriteTeam ?? undefined,
    favoriteSport: professional.favoriteSport ?? undefined,
    hobbies: professional.hobbies ?? undefined,
    notes: professional.notes ?? undefined,
    facilityIds: professional.facilityIds,
    facilities,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

function serializeProfessionalSummary(professional: ProfessionalRecord) {
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
    hobbies: input.hobbies,
    notes: input.notes,
    manuallyEditedAt: new Date(),
  };
}

interface Dependencies {
  doctorRepository: ProfessionalRepository;
}

export class ListProfessionalsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const { professionals, total } = await this.deps.doctorRepository.findAll({
      page,
      limit,
      search: input.search,
      facilityId: input.facilityId,
      specialty: input.specialty,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, facilityIds: input.scope.facilityIds },
    });

    return {
      data: professionals.map(serializeProfessionalSummary),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
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

    return serializeProfessionalProfile(professional, this.deps.doctorRepository);
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

    return serializeProfessionalProfile(professional, this.deps.doctorRepository);
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

    return serializeProfessionalProfile(professional, this.deps.doctorRepository);
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
