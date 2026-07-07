import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ProfessionalCreateInput,
  ProfessionalFacilitySummary,
  ProfessionalListScopeFilter,
  ProfessionalRecord,
  ProfessionalRepository,
  ProfessionalSourceUpsertInput,
  ProfessionalUpdateInput,
} from "../../../application/interfaces/professional.repository.interface";

type ProfessionalRow = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  socialName: string | null;
  taxId: string | null;
  birthDate: Date | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  email: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  favoriteTeam: string | null;
  favoriteSport: string | null;
  hobbies: string | null;
  notes: string | null;
  primarySpecialtyLabel: string | null;
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  sourceProvider: string | null;
  externalSourceId: string | null;
  sourceContentHash: string | null;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  sourcePresent: boolean;
  sourceTracked: boolean;
  manuallyEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  facilityAssociations: Array<{ facilityId: string; endedAt: Date | null }>;
};

function resolveFullName(
  firstName: string,
  lastName: string,
  fullName?: string | null
): string {
  return fullName?.trim() || `${firstName} ${lastName}`.trim();
}

function mapProfessional(professional: ProfessionalRow): ProfessionalRecord {
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
    facilityIds: professional.facilityAssociations
      .filter((a) => a.endedAt === null)
      .map((a) => a.facilityId),
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt,
    deletedAt: professional.deletedAt,
  };
}

function buildScopeFilter(scope: ProfessionalListScopeFilter) {
  if (scope.isGlobal) {
    return {};
  }

  const facilityIds = scope.facilityIds?.length ? scope.facilityIds : ["__none__"];

  return {
    facilityAssociations: {
      some: {
        facilityId: { in: facilityIds },
        endedAt: null,
      },
    },
  };
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
    hobbies: data.hobbies ?? null,
    notes: data.notes ?? null,
    primarySpecialtyLabel: data.specialty ?? null,
    crmCouncil: data.crmCouncil ?? null,
    crmNumber: data.crmNumber ?? null,
    crmState: data.crmState ?? null,
  };
}

function buildPersonUpdateData(data: ProfessionalUpdateInput) {
  const nextFirstName = data.firstName;
  const nextLastName = data.lastName;

  return {
    ...(nextFirstName !== undefined ? { firstName: nextFirstName } : {}),
    ...(nextLastName !== undefined ? { lastName: nextLastName } : {}),
    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
    ...(data.socialName !== undefined ? { socialName: data.socialName } : {}),
    ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
    ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
    ...(data.mobilePhone !== undefined ? { mobilePhone: data.mobilePhone } : {}),
    ...(data.landlinePhone !== undefined ? { landlinePhone: data.landlinePhone } : {}),
    ...(data.email !== undefined ? { email: data.email } : {}),
    ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
    ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    ...(data.favoriteTeam !== undefined ? { favoriteTeam: data.favoriteTeam } : {}),
    ...(data.favoriteSport !== undefined ? { favoriteSport: data.favoriteSport } : {}),
    ...(data.hobbies !== undefined ? { hobbies: data.hobbies } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.specialty !== undefined
      ? { primarySpecialtyLabel: data.specialty }
      : {}),
    ...(data.crmCouncil !== undefined ? { crmCouncil: data.crmCouncil } : {}),
    ...(data.crmNumber !== undefined ? { crmNumber: data.crmNumber } : {}),
    ...(data.crmState !== undefined ? { crmState: data.crmState } : {}),
    ...(data.manuallyEditedAt !== undefined
      ? { manuallyEditedAt: data.manuallyEditedAt }
      : {}),
  };
}

const professionalInclude = {
  facilityAssociations: {
    select: { facilityId: true, endedAt: true },
  },
} as const;

export class PrismaProfessionalRepository implements ProfessionalRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: string;
    scope: ProfessionalListScopeFilter;
  }): Promise<{ professionals: ProfessionalRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...buildScopeFilter(params.scope),
      ...(params.facilityId
        ? {
            facilityAssociations: {
              some: {
                facilityId: params.facilityId,
                endedAt: null,
              },
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: "insensitive" as const } },
              { lastName: { contains: params.search, mode: "insensitive" as const } },
              { fullName: { contains: params.search, mode: "insensitive" as const } },
              {
                primarySpecialtyLabel: {
                  contains: params.search,
                  mode: "insensitive" as const,
                },
              },
              { taxId: { contains: params.search, mode: "insensitive" as const } },
              { crmNumber: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const skip = (params.page - 1) * params.limit;

    const [professionals, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        include: professionalInclude,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: params.limit,
      }),
      prisma.professional.count({ where }),
    ]);

    return {
      professionals: professionals.map(mapProfessional),
      total,
    };
  }

  async findById(id: string): Promise<ProfessionalRecord | null> {
    const professional = await prisma.professional.findFirst({
      where: { id, deletedAt: null },
      include: professionalInclude,
    });

    return professional ? mapProfessional(professional) : null;
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ProfessionalRecord | null> {
    const professional = await prisma.professional.findFirst({
      where: { sourceProvider, externalSourceId, deletedAt: null },
      include: professionalInclude,
    });

    return professional ? mapProfessional(professional) : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<ProfessionalRecord[]> {
    const professionals = await prisma.professional.findMany({
      where: { sourceProvider, sourceTracked: true, deletedAt: null },
      include: professionalInclude,
    });

    return professionals.map(mapProfessional);
  }

  async findActiveFacilities(professionalId: string): Promise<ProfessionalFacilitySummary[]> {
    const associations = await prisma.facilityProfessional.findMany({
      where: { professionalId, endedAt: null },
      include: {
        facility: {
          select: { id: true, displayName: true, legalName: true, tradeName: true },
        },
      },
      orderBy: { facility: { displayName: "asc" } },
    });

    return associations.map((row) => ({
      id: row.facility.id,
      name:
        row.facility.displayName?.trim() ||
        row.facility.tradeName?.trim() ||
        row.facility.legalName?.trim() ||
        row.facility.id,
    }));
  }

  async create(data: ProfessionalCreateInput): Promise<ProfessionalRecord> {
    const now = new Date();

    const professional = await prisma.professional.create({
      data: {
        ...buildPersonCreateData(data),
        ...(data.facilityIds.length > 0
          ? {
              facilityAssociations: {
                create: data.facilityIds.map((facilityId) => ({
                  facilityId,
                  confirmedAt: now,
                  confirmedByUserId: data.confirmedByUserId ?? null,
                })),
              },
            }
          : {}),
      },
      include: professionalInclude,
    });

    return mapProfessional(professional);
  }

  async update(id: string, data: ProfessionalUpdateInput): Promise<ProfessionalRecord> {
    const existing = await prisma.professional.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, fullName: true },
    });

    if (!existing) {
      throw new Error("Professional not found");
    }

    const updateData = buildPersonUpdateData(data);

    if (
      data.fullName === undefined &&
      (data.firstName !== undefined || data.lastName !== undefined)
    ) {
      const professional = await prisma.professional.update({
        where: { id },
        data: {
          ...updateData,
          fullName: resolveFullName(
            data.firstName ?? existing.firstName,
            data.lastName ?? existing.lastName,
            existing.fullName
          ),
        },
        include: professionalInclude,
      });

      return mapProfessional(professional);
    }

    const professional = await prisma.professional.update({
      where: { id },
      data: updateData,
      include: professionalInclude,
    });

    return mapProfessional(professional);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.professional.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await prisma.professional.update({
      where: { id },
      data: {
        sourcePresent: false,
        sourceLastSeenAt,
      },
    });
  }

  async upsertFromSource(input: ProfessionalSourceUpsertInput): Promise<{
    professional: ProfessionalRecord;
    created: boolean;
    updated: boolean;
  }> {
    const existing = await prisma.professional.findFirst({
      where: {
        sourceProvider: input.sourceProvider,
        externalSourceId: input.externalSourceId,
      },
      include: professionalInclude,
    });

    const sourcePersonFields = {
      firstName: input.firstName,
      lastName: input.lastName,
      fullName:
        input.fullName?.trim() ||
        resolveFullName(input.firstName, input.lastName, null),
      socialName: input.socialName ?? null,
      taxId: input.taxId ?? null,
      primarySpecialtyLabel: input.specialty,
      crmCouncil: input.crmCouncil ?? null,
      crmNumber: input.crmNumber ?? null,
      crmState: input.crmState ?? null,
    };

    if (!existing) {
      const professional = await prisma.professional.create({
        data: {
          ...sourcePersonFields,
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        },
        include: professionalInclude,
      });

      return { professional: mapProfessional(professional), created: true, updated: false };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;
    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      Object.assign(updateData, sourcePersonFields);
    }

    const professional = await prisma.professional.update({
      where: { id: existing.id },
      data: updateData,
      include: professionalInclude,
    });

    return {
      professional: mapProfessional(professional),
      created: false,
      updated: !hashUnchanged || !existing.manuallyEditedAt,
    };
  }

  async findExistingFacilityIds(facilityIds: string[]): Promise<string[]> {
    if (facilityIds.length === 0) {
      return [];
    }

    const facilities = await prisma.facility.findMany({
      where: {
        id: { in: facilityIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    return facilities.map((facility) => facility.id);
  }
}
