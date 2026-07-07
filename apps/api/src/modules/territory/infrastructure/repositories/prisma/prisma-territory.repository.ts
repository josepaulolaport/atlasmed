import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  CreateTerritoryInput,
  TerritoryRecord,
  TerritoryRepository,
} from "../../../application/interfaces/territory.repository.interface";
import type { TerritoryTypeRecord } from "../../../application/interfaces/territory-type.repository.interface";

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
  participatesInGroupingHierarchy: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryTypeRecord {
  return record;
}

function mapTerritory(territory: {
  id: string;
  name: string;
  slug: string;
  code: string;
  nodeType: TerritoryRecord["nodeType"];
  territoryTypeId: string;
  territoryType?: Parameters<typeof mapType>[0];
  countryCode: string | null;
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  managerTerritoryId: string | null;
  isActive: boolean;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryRecord {
  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    nodeType: territory.nodeType,
    territoryTypeId: territory.territoryTypeId,
    territoryType: territory.territoryType ? mapType(territory.territoryType) : undefined,
    countryCode: territory.countryCode,
    regionSlug: territory.regionSlug,
    stateCode: territory.stateCode,
    parentId: territory.parentId,
    managerTerritoryId: territory.managerTerritoryId,
    isActive: territory.isActive,
    organizationId: territory.organizationId,
    createdAt: territory.createdAt,
    updatedAt: territory.updatedAt,
  };
}

const territoryInclude = { territoryType: true } as const;

export class PrismaTerritoryRepository implements TerritoryRepository {
  async findById(id: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findUnique({
      where: { id },
      include: territoryInclude,
    });
    return territory ? mapTerritory(territory) : null;
  }

  async findBySlug(slug: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findUnique({
      where: { slug: slug.toLowerCase() },
      include: territoryInclude,
    });
    return territory ? mapTerritory(territory) : null;
  }

  async findByCode(code: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findUnique({
      where: { code },
      include: territoryInclude,
    });
    return territory ? mapTerritory(territory) : null;
  }

  async findByIds(ids: string[]): Promise<TerritoryRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const territories = await prisma.territory.findMany({
      where: { id: { in: ids } },
      include: territoryInclude,
    });
    return territories.map(mapTerritory);
  }

  async findAllActive(): Promise<TerritoryRecord[]> {
    const territories = await prisma.territory.findMany({
      where: { isActive: true },
      include: territoryInclude,
      orderBy: [{ code: "asc" }],
    });
    return territories.map(mapTerritory);
  }

  async findActiveByTypeSlug(typeSlug: string): Promise<TerritoryRecord[]> {
    const territories = await prisma.territory.findMany({
      where: {
        isActive: true,
        territoryType: { slug: typeSlug },
      },
      include: territoryInclude,
      orderBy: [{ name: "asc" }],
    });
    return territories.map(mapTerritory);
  }

  async findChildren(parentId: string, activeOnly = true): Promise<TerritoryRecord[]> {
    const territories = await prisma.territory.findMany({
      where: {
        parentId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: territoryInclude,
      orderBy: [{ name: "asc" }],
    });
    return territories.map(mapTerritory);
  }

  async countActiveChildren(parentId: string): Promise<number> {
    return prisma.territory.count({
      where: { parentId, isActive: true },
    });
  }

  async countRepPatchesByManagerZone(managerTerritoryId: string): Promise<number> {
    return prisma.territory.count({
      where: {
        managerTerritoryId,
        isActive: true,
        territoryType: { assignsClinics: true },
      },
    });
  }

  async countClinics(territoryId: string): Promise<number> {
    return prisma.facility.count({
      where: {
        deletedAt: null,
        territoryId,
      },
    });
  }

  async countAssignedUsers(territoryId: string): Promise<number> {
    return prisma.userTerritoryAssignment.count({
      where: { territoryId },
    });
  }

  async create(input: CreateTerritoryInput): Promise<TerritoryRecord> {
    const territory = await prisma.territory.create({
      data: {
        name: input.name,
        slug: input.slug,
        code: input.code ?? input.slug.toUpperCase(),
        nodeType: input.nodeType,
        territoryTypeId: input.territoryTypeId,
        countryCode: input.countryCode ?? null,
        regionSlug: input.regionSlug ?? null,
        stateCode: input.stateCode ?? null,
        parentId: input.parentId ?? null,
        managerTerritoryId: input.managerTerritoryId ?? null,
        organizationId: input.organizationId ?? null,
      },
      include: territoryInclude,
    });
    return mapTerritory(territory);
  }

  async update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      managerTerritoryId?: string | null;
      isActive?: boolean;
      countryCode?: string | null;
    }
  ): Promise<TerritoryRecord> {
    const territory = await prisma.territory.update({
      where: { id },
      data,
      include: territoryInclude,
    });
    return mapTerritory(territory);
  }

  async findActiveCountryByCode(countryCode: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findFirst({
      where: {
        isActive: true,
        countryCode,
        territoryType: { isCountryLevel: true },
      },
      include: territoryInclude,
    });
    return territory ? mapTerritory(territory) : null;
  }

  async findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: string[]): Promise<string[]> {
    if (managerTerritoryIds.length === 0) {
      return [];
    }

    const patches = await prisma.territory.findMany({
      where: {
        isActive: true,
        managerTerritoryId: { in: managerTerritoryIds },
        territoryType: { assignsClinics: true },
      },
      select: { id: true },
    });

    return patches.map((patch) => patch.id);
  }
}
