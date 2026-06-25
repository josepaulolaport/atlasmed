import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  TerritoryRollupLinkRecord,
  TerritoryRollupRepository,
} from "../../../application/interfaces/territory-rollup.repository.interface";

const ancestorSelect = {
  id: true,
  name: true,
  code: true,
  slug: true,
  territoryType: {
    select: {
      slug: true,
      name: true,
    },
  },
} as const;

function mapRollupLink(link: {
  id: string;
  territoryId: string;
  ancestorId: string;
  relationshipType: TerritoryRollupLinkRecord["relationshipType"];
  source: TerritoryRollupLinkRecord["source"];
  createdAt: Date;
  ancestor?: {
    id: string;
    name: string;
    code: string;
    slug: string;
    territoryType: {
      slug: string;
      name: string;
    };
  };
}): TerritoryRollupLinkRecord {
  return {
    id: link.id,
    territoryId: link.territoryId,
    ancestorId: link.ancestorId,
    relationshipType: link.relationshipType,
    source: link.source,
    createdAt: link.createdAt,
    ancestor: link.ancestor
      ? {
          id: link.ancestor.id,
          name: link.ancestor.name,
          code: link.ancestor.code,
          slug: link.ancestor.slug,
          territoryType: link.ancestor.territoryType,
        }
      : undefined,
  };
}

export class PrismaTerritoryRollupRepository implements TerritoryRollupRepository {
  async listByTerritoryId(territoryId: string): Promise<TerritoryRollupLinkRecord[]> {
    const links = await prisma.territoryRollupLink.findMany({
      where: { territoryId },
      include: {
        ancestor: {
          select: ancestorSelect,
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });
    return links.map(mapRollupLink);
  }

  async findById(id: string): Promise<TerritoryRollupLinkRecord | null> {
    const link = await prisma.territoryRollupLink.findUnique({
      where: { id },
      include: {
        ancestor: {
          select: ancestorSelect,
        },
      },
    });
    return link ? mapRollupLink(link) : null;
  }

  async create(input: {
    territoryId: string;
    ancestorId: string;
    relationshipType?: TerritoryRollupLinkRecord["relationshipType"];
    source?: TerritoryRollupLinkRecord["source"];
  }): Promise<TerritoryRollupLinkRecord> {
    const link = await prisma.territoryRollupLink.create({
      data: {
        territoryId: input.territoryId,
        ancestorId: input.ancestorId,
        relationshipType: input.relationshipType ?? "reporting",
        source: input.source ?? "manual",
      },
      include: {
        ancestor: {
          select: ancestorSelect,
        },
      },
    });
    return mapRollupLink(link);
  }

  async delete(id: string): Promise<void> {
    await prisma.territoryRollupLink.delete({ where: { id } });
  }

  async deleteGeoRollupLinks(territoryId: string): Promise<void> {
    await prisma.territoryRollupLink.deleteMany({
      where: { territoryId, source: "geo" },
    });
  }

  async replaceGeoRollupLinks(territoryId: string, ancestorIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.territoryRollupLink.deleteMany({
        where: { territoryId, source: "geo" },
      });

      if (ancestorIds.length === 0) {
        return;
      }

      await tx.territoryRollupLink.createMany({
        data: ancestorIds.map((ancestorId) => ({
          territoryId,
          ancestorId,
          relationshipType: "reporting" as const,
          source: "geo" as const,
        })),
        skipDuplicates: true,
      });
    });
  }
}
