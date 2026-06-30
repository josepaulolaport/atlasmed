import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  FacilityListScopeFilter,
  FacilityRecord,
  FacilityRepository,
  FacilitySourceUpsertInput,
} from "../../../application/interfaces/facility.repository.interface";

function mapFacility(facility: {
  id: string;
  displayName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentStatus: FacilityRecord["territoryAssignmentStatus"];
  territoryAssignmentSource: FacilityRecord["territoryAssignmentSource"];
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
}): FacilityRecord {
  return {
    id: facility.id,
    name: facility.displayName,
    address: facility.address,
    lat: facility.lat,
    lng: facility.lng,
    territoryId: facility.territoryId,
    territoryAssignmentStatus: facility.territoryAssignmentStatus,
    territoryAssignmentSource: facility.territoryAssignmentSource,
    sourceProvider: facility.sourceProvider,
    externalSourceId: facility.externalSourceId,
    sourceContentHash: facility.sourceContentHash,
    sourceFirstSeenAt: facility.sourceFirstSeenAt,
    sourceLastSeenAt: facility.sourceLastSeenAt,
    sourcePresent: facility.sourcePresent,
    sourceTracked: facility.sourceTracked,
    manuallyEditedAt: facility.manuallyEditedAt,
    createdAt: facility.createdAt,
    updatedAt: facility.updatedAt,
    deletedAt: facility.deletedAt,
  };
}

function buildScopeWhere(scope: FacilityListScopeFilter) {
  if (scope.isGlobal) {
    return {};
  }

  return {
    id: {
      in: scope.facilityIds?.length ? scope.facilityIds : ["__none__"],
    },
  };
}

export class PrismaFacilityRepository implements FacilityRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    scope: FacilityListScopeFilter;
  }): Promise<{ facilities: FacilityRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...buildScopeWhere(params.scope),
      ...(params.search
        ? {
            displayName: {
              contains: params.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const skip = (params.page - 1) * params.limit;

    const [facilities, total] = await Promise.all([
      prisma.facility.findMany({
        where,
        orderBy: { displayName: "asc" },
        skip,
        take: params.limit,
      }),
      prisma.facility.count({ where }),
    ]);

    return {
      facilities: facilities.map(mapFacility),
      total,
    };
  }

  async findById(id: string): Promise<FacilityRecord | null> {
    const facility = await prisma.facility.findFirst({
      where: { id, deletedAt: null },
    });

    return facility ? mapFacility(facility) : null;
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<FacilityRecord | null> {
    const facility = await prisma.facility.findFirst({
      where: { sourceProvider, externalSourceId },
    });

    return facility ? mapFacility(facility) : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<FacilityRecord[]> {
    const facilities = await prisma.facility.findMany({
      where: { sourceProvider, sourceTracked: true },
    });

    return facilities.map(mapFacility);
  }

  async create(data: {
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<FacilityRecord> {
    const facility = await prisma.facility.create({
      data: {
        displayName: data.name,
        address: data.address ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      },
    });

    return mapFacility(facility);
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
  ): Promise<FacilityRecord> {
    const facility = await prisma.facility.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { displayName: data.name } : {}),
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        manuallyEditedAt: data.manuallyEditedAt,
      },
    });

    return mapFacility(facility);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.facility.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reactivate(id: string): Promise<FacilityRecord> {
    const facility = await prisma.facility.update({
      where: { id },
      data: { deletedAt: null },
    });

    return mapFacility(facility);
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await prisma.facility.update({
      where: { id },
      data: {
        sourcePresent: false,
        sourceLastSeenAt,
      },
    });
  }

  async upsertFromSource(input: FacilitySourceUpsertInput): Promise<{
    facility: FacilityRecord;
    created: boolean;
    updated: boolean;
  }> {
    const existing = await prisma.facility.findFirst({
      where: {
        sourceProvider: input.sourceProvider,
        externalSourceId: input.externalSourceId,
      },
    });

    if (!existing) {
      const facility = await prisma.facility.create({
        data: {
          displayName: input.name,
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

      return { facility: mapFacility(facility), created: true, updated: false };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;
    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    const facility = await prisma.facility.update({
      where: { id: existing.id },
      data: updateData,
    });

    return {
      facility: mapFacility(facility),
      created: false,
      updated: !hashUnchanged,
    };
  }

  async applyApprovedFieldUpdates(
    id: string,
    updates: {
      name?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<FacilityRecord> {
    const facility = await prisma.facility.update({
      where: { id },
      data: {
        ...(updates.name !== undefined ? { displayName: updates.name } : {}),
        ...(updates.address !== undefined ? { address: updates.address } : {}),
        ...(updates.lat !== undefined ? { lat: updates.lat } : {}),
        ...(updates.lng !== undefined ? { lng: updates.lng } : {}),
      },
    });

    return mapFacility(facility);
  }

  async findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]> {
    if (territoryIds.length === 0) {
      return [];
    }

    const facilities = await prisma.facility.findMany({
      where: {
        deletedAt: null,
        territoryId: { in: territoryIds },
      },
      select: { id: true },
    });

    return facilities.map((facility) => facility.id);
  }
}
