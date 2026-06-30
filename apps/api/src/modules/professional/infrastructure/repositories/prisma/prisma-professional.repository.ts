import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ProfessionalListScopeFilter,
  ProfessionalRecord,
  ProfessionalRepository,
  ProfessionalSourceUpsertInput,
} from "../../../application/interfaces/professional.repository.interface";

function mapProfessional(professional: {
  id: string;
  firstName: string;
  lastName: string;
  primarySpecialtyLabel: string | null;
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
}): ProfessionalRecord {
  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    specialty: professional.primarySpecialtyLabel,
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
              {
                firstName: {
                  contains: params.search,
                  mode: "insensitive" as const,
                },
              },
              {
                lastName: {
                  contains: params.search,
                  mode: "insensitive" as const,
                },
              },
              {
                primarySpecialtyLabel: {
                  contains: params.search,
                  mode: "insensitive" as const,
                },
              },
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

  async create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    facilityIds: string[];
    confirmedByUserId?: string;
  }): Promise<ProfessionalRecord> {
    const now = new Date();

    const professional = await prisma.professional.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        primarySpecialtyLabel: data.specialty ?? null,
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

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      specialty?: string | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<ProfessionalRecord> {
    const professional = await prisma.professional.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.specialty !== undefined
          ? { primarySpecialtyLabel: data.specialty }
          : {}),
        manuallyEditedAt: data.manuallyEditedAt,
      },
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

    if (!existing) {
      const professional = await prisma.professional.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          fullName: `${input.firstName} ${input.lastName}`.trim(),
          primarySpecialtyLabel: input.specialty,
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
      updateData.firstName = input.firstName;
      updateData.lastName = input.lastName;
      updateData.fullName = `${input.firstName} ${input.lastName}`.trim();
      updateData.primarySpecialtyLabel = input.specialty;
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
