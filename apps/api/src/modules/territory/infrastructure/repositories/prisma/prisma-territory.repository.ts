import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  CreateTerritoryInput,
  TerritoryRecord,
  TerritoryRepository,
} from "../../application/interfaces/territory.repository.interface";

function mapTerritory(territory: {
  id: string;
  name: string;
  code: string;
  nodeType: TerritoryRecord["nodeType"];
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  isActive: boolean;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryRecord {
  return {
    id: territory.id,
    name: territory.name,
    code: territory.code,
    nodeType: territory.nodeType,
    regionSlug: territory.regionSlug,
    stateCode: territory.stateCode,
    parentId: territory.parentId,
    isActive: territory.isActive,
    organizationId: territory.organizationId,
    createdAt: territory.createdAt,
    updatedAt: territory.updatedAt,
  };
}

export class PrismaTerritoryRepository implements TerritoryRepository {
  async findById(id: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findUnique({ where: { id } });
    return territory ? mapTerritory(territory) : null;
  }

  async findByCode(code: string): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findUnique({ where: { code } });
    return territory ? mapTerritory(territory) : null;
  }

  async findAllActive(): Promise<TerritoryRecord[]> {
    const territories = await prisma.territory.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }],
    });
    return territories.map(mapTerritory);
  }

  async findChildren(parentId: string, activeOnly = true): Promise<TerritoryRecord[]> {
    const territories = await prisma.territory.findMany({
      where: {
        parentId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ name: "asc" }],
    });
    return territories.map(mapTerritory);
  }

  async countActiveChildren(parentId: string): Promise<number> {
    return prisma.territory.count({
      where: { parentId, isActive: true },
    });
  }

  async countClinics(territoryId: string): Promise<number> {
    return prisma.clinic.count({
      where: { territoryId, deletedAt: null },
    });
  }

  async countAssignedUsers(territoryId: string): Promise<number> {
    return prisma.userTerritoryAssignment.count({
      where: { territoryId },
    });
  }

  async countPatchesUnderParent(parentId: string): Promise<number> {
    return prisma.territory.count({
      where: { parentId, nodeType: "patch" },
    });
  }

  async create(input: CreateTerritoryInput): Promise<TerritoryRecord> {
    const territory = await prisma.territory.create({
      data: {
        name: input.name,
        code: input.code,
        nodeType: input.nodeType,
        regionSlug: input.regionSlug ?? null,
        stateCode: input.stateCode ?? null,
        parentId: input.parentId ?? null,
        organizationId: input.organizationId ?? null,
      },
    });
    return mapTerritory(territory);
  }

  async update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      isActive?: boolean;
      regionSlug?: string | null;
      stateCode?: string | null;
    }
  ): Promise<TerritoryRecord> {
    const territory = await prisma.territory.update({
      where: { id },
      data,
    });
    return mapTerritory(territory);
  }

  async findActiveRoot(): Promise<TerritoryRecord | null> {
    const territory = await prisma.territory.findFirst({
      where: { nodeType: "root", isActive: true },
    });
    return territory ? mapTerritory(territory) : null;
  }
}
