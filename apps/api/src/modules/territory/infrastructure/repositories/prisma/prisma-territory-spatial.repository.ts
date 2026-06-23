import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  GeoJsonGeometry,
  OverlappingTerritory,
  TerritorySpatialRepository,
} from "../../../application/interfaces/territory-spatial.repository.interface";
import { OperationNotAllowedError } from "../../../../../shared/errors";

export class PrismaTerritorySpatialRepository implements TerritorySpatialRepository {
  async getBoundaryAsGeoJson(territoryId: string): Promise<GeoJsonGeometry | null> {
    const rows = await prisma.$queryRaw<Array<{ geojson: string | null }>>`
      SELECT ST_AsGeoJSON(boundary)::text AS geojson
      FROM territories
      WHERE id = ${territoryId}
        AND boundary IS NOT NULL
    `;

    const raw = rows[0]?.geojson;
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as GeoJsonGeometry;
  }

  async saveBoundary(territoryId: string, geoJson: GeoJsonGeometry): Promise<void> {
    this.assertValidGeometryType(geoJson);

    const geoJsonString = JSON.stringify(geoJson);

    const validation = await prisma.$queryRaw<
      Array<{ is_valid: boolean; reason: string | null }>
    >`
      SELECT
        ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS is_valid,
        ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS reason
    `;

    if (!validation[0]?.is_valid) {
      throw new OperationNotAllowedError(
        "save_boundary",
        validation[0]?.reason ?? "Invalid geometry"
      );
    }

    await prisma.$executeRaw`
      UPDATE territories
      SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326),
          "updatedAt" = NOW()
      WHERE id = ${territoryId}
    `;
  }

  async deleteBoundary(territoryId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE territories
      SET boundary = NULL,
          "updatedAt" = NOW()
      WHERE id = ${territoryId}
    `;
  }

  async hasBoundary(territoryId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ has_boundary: boolean }>>`
      SELECT boundary IS NOT NULL AS has_boundary
      FROM territories
      WHERE id = ${territoryId}
    `;
    return rows[0]?.has_boundary ?? false;
  }

  async findOverlappingLeaves(
    territoryId: string,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]> {
    const geoJsonString = JSON.stringify(geoJson);

    return prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT t.id, t.code
      FROM territories t
      WHERE t.id != ${territoryId}
        AND t."isActive" = true
        AND t.boundary IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM territories c
          WHERE c."parentId" = t.id
            AND c."isActive" = true
        )
        AND ST_Intersects(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
        AND NOT ST_Touches(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
    `;
  }

  async findContainingLeafTerritoryId(lng: number, lat: number): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT t.id
      FROM territories t
      WHERE t."isActive" = true
        AND t.boundary IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM territories c
          WHERE c."parentId" = t.id
            AND c."isActive" = true
        )
        AND ST_Covers(
          t.boundary,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
    `;

    return rows.map((row) => row.id);
  }

  private assertValidGeometryType(geoJson: GeoJsonGeometry): void {
    if (geoJson.type !== "Polygon" && geoJson.type !== "MultiPolygon") {
      throw new OperationNotAllowedError(
        "save_boundary",
        "Boundary must be a GeoJSON Polygon or MultiPolygon"
      );
    }
  }
}
