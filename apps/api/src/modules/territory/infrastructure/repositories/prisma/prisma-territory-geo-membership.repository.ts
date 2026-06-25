import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  GeoMembershipCandidate,
  TerritoryGeoMembershipRecord,
  TerritoryGeoMembershipRepository,
} from "../../../application/interfaces/territory-geo-membership.repository.interface";
import { GEO_MEMBERSHIP_REFERENCE_TYPE_SLUGS } from "../../../application/constants/territory-geo-membership.constants";

const operationalInclude = {
  operationalTerritory: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      territoryType: { select: { slug: true, name: true } },
    },
  },
  referenceTerritory: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      territoryType: { select: { slug: true, name: true } },
    },
  },
} as const;

function mapRecord(row: {
  id: string;
  operationalTerritoryId: string;
  referenceTerritoryId: string;
  referenceTypeSlug: string;
  overlapRatio: number;
  intersectionAreaSqKm: number;
  computedAt: Date;
  operationalTerritory?: TerritoryGeoMembershipRecord["operationalTerritory"];
  referenceTerritory?: TerritoryGeoMembershipRecord["referenceTerritory"];
}): TerritoryGeoMembershipRecord {
  return {
    id: row.id,
    operationalTerritoryId: row.operationalTerritoryId,
    referenceTerritoryId: row.referenceTerritoryId,
    referenceTypeSlug: row.referenceTypeSlug,
    overlapRatio: row.overlapRatio,
    intersectionAreaSqKm: row.intersectionAreaSqKm,
    computedAt: row.computedAt,
    operationalTerritory: row.operationalTerritory,
    referenceTerritory: row.referenceTerritory,
  };
}

export class PrismaTerritoryGeoMembershipRepository implements TerritoryGeoMembershipRepository {
  async deleteForOperationalTerritory(operationalTerritoryId: string): Promise<void> {
    await prisma.territoryGeoMembership.deleteMany({
      where: { operationalTerritoryId },
    });
  }

  async insertRows(
    rows: Array<{
      operationalTerritoryId: string;
      referenceTerritoryId: string;
      referenceTypeSlug: string;
      overlapRatio: number;
      intersectionAreaSqKm: number;
    }>
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await prisma.territoryGeoMembership.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  async findOperationalTerritoryIdsByReferenceIds(
    referenceTerritoryIds: string[]
  ): Promise<string[]> {
    if (referenceTerritoryIds.length === 0) {
      return [];
    }

    const rows = await prisma.territoryGeoMembership.findMany({
      where: { referenceTerritoryId: { in: referenceTerritoryIds } },
      select: { operationalTerritoryId: true },
      distinct: ["operationalTerritoryId"],
    });

    return rows.map((row) => row.operationalTerritoryId);
  }

  async findReferenceTerritoryIdsByOperationalIds(
    operationalTerritoryIds: string[]
  ): Promise<string[]> {
    if (operationalTerritoryIds.length === 0) {
      return [];
    }

    const rows = await prisma.territoryGeoMembership.findMany({
      where: { operationalTerritoryId: { in: operationalTerritoryIds } },
      select: { referenceTerritoryId: true },
      distinct: ["referenceTerritoryId"],
    });

    return rows.map((row) => row.referenceTerritoryId);
  }

  async listByReferenceTerritoryId(
    referenceTerritoryId: string
  ): Promise<TerritoryGeoMembershipRecord[]> {
    const rows = await prisma.territoryGeoMembership.findMany({
      where: { referenceTerritoryId },
      include: operationalInclude,
      orderBy: [{ overlapRatio: "desc" }, { computedAt: "desc" }],
    });

    return rows.map(mapRecord);
  }

  async listByOperationalTerritoryId(
    operationalTerritoryId: string
  ): Promise<TerritoryGeoMembershipRecord[]> {
    const rows = await prisma.territoryGeoMembership.findMany({
      where: { operationalTerritoryId },
      include: operationalInclude,
      orderBy: [{ overlapRatio: "desc" }, { computedAt: "desc" }],
    });

    return rows.map(mapRecord);
  }

  async computeCandidates(input: {
    operationalTerritoryId: string;
    countryCode: string;
    minOverlapRatio: number;
  }): Promise<GeoMembershipCandidate[]> {
    const referenceTypeSlugs = [...GEO_MEMBERSHIP_REFERENCE_TYPE_SLUGS];

    const rows = await prisma.$queryRaw<
      Array<{
        reference_territory_id: string;
        reference_type_slug: string;
        overlap_ratio: number;
        intersection_area_sq_km: number;
      }>
    >`
      WITH operational AS (
        SELECT boundary AS geom
        FROM territories
        WHERE id = ${input.operationalTerritoryId}
          AND boundary IS NOT NULL
      ),
      operational_area AS (
        SELECT ST_Area(geom::geography) AS area
        FROM operational
      )
      SELECT
        t.id AS reference_territory_id,
        tt.slug AS reference_type_slug,
        CASE
          WHEN oa.area = 0 THEN 0
          ELSE ST_Area(ST_Intersection(t.boundary, o.geom)::geography) / oa.area
        END AS overlap_ratio,
        ST_Area(ST_Intersection(t.boundary, o.geom)::geography) / 1000000 AS intersection_area_sq_km
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t."territoryTypeId"
      CROSS JOIN operational o
      CROSS JOIN operational_area oa
      WHERE t."isActive" = true
        AND t.boundary IS NOT NULL
        AND t.id != ${input.operationalTerritoryId}
        AND t."countryCode" = ${input.countryCode}
        AND tt.slug = ANY(${referenceTypeSlugs})
        AND ST_Intersects(t.boundary, o.geom)
        AND ST_Area(ST_Intersection(t.boundary, o.geom)::geography) > 0
    `;

    return rows
      .filter((row) => Number(row.overlap_ratio) >= input.minOverlapRatio)
      .map((row) => ({
        referenceTerritoryId: row.reference_territory_id,
        referenceTypeSlug: row.reference_type_slug,
        overlapRatio: Number(row.overlap_ratio),
        intersectionAreaSqKm: Number(row.intersection_area_sq_km),
      }));
  }
}
