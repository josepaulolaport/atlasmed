import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  CreateTerritoryTypeInput,
  TerritoryTypeRecord,
  TerritoryTypeRepository,
  UpdateTerritoryTypeInput,
} from "../../../application/interfaces/territory-type.repository.interface";

function mapType(record: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  assignsClinics: boolean;
  assignableToUsers: boolean;
  assignableToManagers: boolean;
  isCountryLevel: boolean;
  blockSiblingOverlap: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryTypeRecord {
  return record;
}

export class PrismaTerritoryTypeRepository implements TerritoryTypeRepository {
  async findById(id: string): Promise<TerritoryTypeRecord | null> {
    const record = await prisma.territoryType.findUnique({ where: { id } });
    return record ? mapType(record) : null;
  }

  async findBySlug(slug: string): Promise<TerritoryTypeRecord | null> {
    const record = await prisma.territoryType.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    return record ? mapType(record) : null;
  }

  async findAll(activeOnly = true): Promise<TerritoryTypeRecord[]> {
    const records = await prisma.territoryType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return records.map(mapType);
  }

  async create(input: CreateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const record = await prisma.territoryType.create({
      data: {
        slug: input.slug.toLowerCase(),
        name: input.name,
        description: input.description ?? null,
        canHaveBoundary: input.canHaveBoundary ?? true,
        assignsClinics: input.assignsClinics ?? false,
        assignableToUsers: input.assignableToUsers ?? false,
        assignableToManagers: input.assignableToManagers ?? false,
        isCountryLevel: input.isCountryLevel ?? false,
        blockSiblingOverlap: input.blockSiblingOverlap ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return mapType(record);
  }

  async update(id: string, input: UpdateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const record = await prisma.territoryType.update({
      where: { id },
      data: input,
    });
    return mapType(record);
  }

  async countTerritoriesUsingType(id: string): Promise<number> {
    return prisma.territory.count({ where: { territoryTypeId: id, isActive: true } });
  }
}
