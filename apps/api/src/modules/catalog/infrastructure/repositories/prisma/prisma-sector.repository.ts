import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  SectorRecord,
  SectorRepository,
} from "../../../application/interfaces/sector.repository.interface";

function mapSector(row: {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SectorRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaSectorRepository implements SectorRepository {
  async findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ sectors: SectorRecord[]; total: number }> {
    const where = params.isActive === undefined ? {} : { isActive: params.isActive };
    const skip = (params.page - 1) * params.limit;

    const [sectors, total] = await Promise.all([
      prisma.sector.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: params.limit,
      }),
      prisma.sector.count({ where }),
    ]);

    return { sectors: sectors.map(mapSector), total };
  }

  async findById(id: string): Promise<SectorRecord | null> {
    const sector = await prisma.sector.findUnique({ where: { id } });
    return sector ? mapSector(sector) : null;
  }

  async create(data: {
    slug: string;
    name: string;
    isActive?: boolean;
  }): Promise<SectorRecord> {
    const sector = await prisma.sector.create({
      data: {
        slug: data.slug,
        name: data.name,
        isActive: data.isActive ?? true,
      },
    });
    return mapSector(sector);
  }

  async update(
    id: string,
    data: { slug?: string; name?: string; isActive?: boolean }
  ): Promise<SectorRecord> {
    const sector = await prisma.sector.update({ where: { id }, data });
    return mapSector(sector);
  }
}
