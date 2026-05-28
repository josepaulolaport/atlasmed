import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ClinicListScopeFilter,
  ClinicRecord,
  ClinicRepository,
} from "../../../application/interfaces/clinic.repository.interface";

function mapClinic(clinic: {
  id: string;
  name: string;
  address: string | null;
  territoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): ClinicRecord {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    territoryId: clinic.territoryId,
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

  async create(data: {
    name: string;
    address?: string | null;
    territoryId?: string | null;
  }): Promise<ClinicRecord> {
    const clinic = await prisma.clinic.create({
      data: {
        name: data.name,
        address: data.address ?? null,
        territoryId: data.territoryId ?? null,
      },
    });

    return mapClinic(clinic);
  }

  async update(
    id: string,
    data: {
      name?: string;
      address?: string | null;
      territoryId?: string | null;
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
