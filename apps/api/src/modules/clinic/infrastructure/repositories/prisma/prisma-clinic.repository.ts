import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ClinicListScopeFilter,
  ClinicRecord,
  ClinicRepository,
  ClinicSourceUpsertInput,
} from "../../../application/interfaces/clinic.repository.interface";

function mapClinic(clinic: {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentStatus: ClinicRecord["territoryAssignmentStatus"];
  territoryAssignmentSource: ClinicRecord["territoryAssignmentSource"];
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
}): ClinicRecord {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    lat: clinic.lat,
    lng: clinic.lng,
    territoryId: clinic.territoryId,
    territoryAssignmentStatus: clinic.territoryAssignmentStatus,
    territoryAssignmentSource: clinic.territoryAssignmentSource,
    sourceProvider: clinic.sourceProvider,
    externalSourceId: clinic.externalSourceId,
    sourceContentHash: clinic.sourceContentHash,
    sourceFirstSeenAt: clinic.sourceFirstSeenAt,
    sourceLastSeenAt: clinic.sourceLastSeenAt,
    sourcePresent: clinic.sourcePresent,
    sourceTracked: clinic.sourceTracked,
    manuallyEditedAt: clinic.manuallyEditedAt,
    createdAt: clinic.createdAt,
    updatedAt: clinic.updatedAt,
    deletedAt: clinic.deletedAt,
  };
}

function buildScopeWhere(scope: ClinicListScopeFilter) {
  if (scope.isGlobal) {
    return {};
  }

  return {
    id: {
      in: scope.clinicIds?.length ? scope.clinicIds : ["__none__"],
    },
  };
}

export class PrismaClinicRepository implements ClinicRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    scope: ClinicListScopeFilter;
  }): Promise<{ clinics: ClinicRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...buildScopeWhere(params.scope),
      ...(params.search
        ? {
            name: {
              contains: params.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const skip = (params.page - 1) * params.limit;

    const [clinics, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: params.limit,
      }),
      prisma.clinic.count({ where }),
    ]);

    return {
      clinics: clinics.map(mapClinic),
      total,
    };
  }

  async findById(id: string): Promise<ClinicRecord | null> {
    const clinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
    });

    return clinic ? mapClinic(clinic) : null;
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ClinicRecord | null> {
    const clinic = await prisma.clinic.findFirst({
      where: { sourceProvider, externalSourceId },
    });

    return clinic ? mapClinic(clinic) : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<ClinicRecord[]> {
    const clinics = await prisma.clinic.findMany({
      where: { sourceProvider, sourceTracked: true },
    });

    return clinics.map(mapClinic);
  }

  async create(data: {
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<ClinicRecord> {
    const clinic = await prisma.clinic.create({
      data: {
        name: data.name,
        address: data.address ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      },
    });

    return mapClinic(clinic);
  }

  async update(
    id: string,
    data: {
      name?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<ClinicRecord> {
    const clinic = await prisma.clinic.update({
      where: { id },
      data,
    });

    return mapClinic(clinic);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.clinic.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reactivate(id: string): Promise<ClinicRecord> {
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { deletedAt: null },
    });

    return mapClinic(clinic);
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await prisma.clinic.update({
      where: { id },
      data: {
        sourcePresent: false,
        sourceLastSeenAt,
      },
    });
  }

  async upsertFromSource(input: ClinicSourceUpsertInput): Promise<{
    clinic: ClinicRecord;
    created: boolean;
    updated: boolean;
  }> {
    const existing = await prisma.clinic.findFirst({
      where: {
        sourceProvider: input.sourceProvider,
        externalSourceId: input.externalSourceId,
      },
    });

    if (!existing) {
      const clinic = await prisma.clinic.create({
        data: {
          name: input.name,
          address: input.address,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        },
      });

      return { clinic: mapClinic(clinic), created: true, updated: false };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;
    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      updateData.name = input.name;
      updateData.address = input.address;
      if (input.lat !== undefined) updateData.lat = input.lat;
      if (input.lng !== undefined) updateData.lng = input.lng;
    }

    const clinic = await prisma.clinic.update({
      where: { id: existing.id },
      data: updateData,
    });

    return {
      clinic: mapClinic(clinic),
      created: false,
      updated: !hashUnchanged || !existing.manuallyEditedAt,
    };
  }

  async findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]> {
    if (territoryIds.length === 0) {
      return [];
    }

    const clinics = await prisma.clinic.findMany({
      where: {
        deletedAt: null,
        territoryId: { in: territoryIds },
      },
      select: { id: true },
    });

    return clinics.map((clinic: { id: string }) => clinic.id);
  }
}
