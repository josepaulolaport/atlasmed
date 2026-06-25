import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  GeoJsonGeometry,
  OverlappingTerritory,
  TerritoryBoundingBox,
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

  async saveBoundary(
    territoryId: string,
    geoJson: GeoJsonGeometry,
    options?: { repairInvalid?: boolean }
  ): Promise<void> {
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
      if (!options?.repairInvalid) {
        throw new OperationNotAllowedError(
          "save_boundary",
          validation[0]?.reason ?? "Invalid geometry"
        );
      }

      await prisma.$executeRaw`
        UPDATE territories
        SET boundary = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)),
            "updatedAt" = NOW()
        WHERE id = ${territoryId}
      `;
      return;
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

  async getBoundaryBoundingBox(territoryId: string): Promise<TerritoryBoundingBox | null> {
    const rows = await prisma.$queryRaw<
      Array<{
        min_lng: number | null;
        min_lat: number | null;
        max_lng: number | null;
        max_lat: number | null;
      }>
    >`
      SELECT
        ST_XMin(extent)::float AS min_lng,
        ST_YMin(extent)::float AS min_lat,
        ST_XMax(extent)::float AS max_lng,
        ST_YMax(extent)::float AS max_lat
      FROM (
        SELECT ST_Extent(boundary) AS extent
        FROM territories
        WHERE id = ${territoryId}
          AND boundary IS NOT NULL
      ) AS bounded
    `;

    const box = rows[0];
    if (
      box?.min_lng == null ||
      box.min_lat == null ||
      box.max_lng == null ||
      box.max_lat == null
    ) {
      return null;
    }

    return {
      minLng: box.min_lng,
      minLat: box.min_lat,
      maxLng: box.max_lng,
      maxLat: box.max_lat,
    };
  }

  async findOverlappingClinicAssignmentTerritories(
    territoryId: string,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]> {
    const geoJsonString = JSON.stringify(geoJson);

    return prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT t.id, t.code
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t."territoryTypeId"
      WHERE t.id != ${territoryId}
        AND t."isActive" = true
        AND t.boundary IS NOT NULL
        AND tt."assignsClinics" = true
        AND ST_Intersects(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
        AND NOT ST_Touches(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
    `;
  }

  async findContainingClinicAssignmentTerritoryIds(lng: number, lat: number): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT t.id
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t."territoryTypeId"
      WHERE t."isActive" = true
        AND t.boundary IS NOT NULL
        AND tt."assignsClinics" = true
        AND ST_Covers(
          t.boundary,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
      ORDER BY ST_Area(t.boundary::geography) ASC
    `;

    return rows.map((row) => row.id);
  }

  async scoreParentCandidates(input: {
    territoryId: string;
    geoJson: GeoJsonGeometry;
    countryCode: string;
    excludeTerritoryIds: string[];
  }): Promise<Array<{ id: string; code: string; overlapRatio: number }>> {
    const geoJsonString = JSON.stringify(input.geoJson);
    const excludeIds = input.excludeTerritoryIds;

    const rows = await prisma.$queryRaw<
      Array<{ id: string; code: string; overlap_ratio: number }>
    >`
      WITH child AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT
        t.id,
        t.code,
        CASE
          WHEN ST_Area(child.geom::geography) = 0 THEN 0
          ELSE ST_Area(ST_Intersection(t.boundary, child.geom)::geography)
            / ST_Area(child.geom::geography)
        END AS overlap_ratio
      FROM territories t
      CROSS JOIN child
      WHERE t."isActive" = true
        AND t.boundary IS NOT NULL
        AND t."countryCode" = ${input.countryCode}
        AND NOT (t.id = ANY(${excludeIds}))
        AND ST_Intersects(t.boundary, child.geom)
    `;

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      overlapRatio: Number(row.overlap_ratio),
    }));
  }

  async findOverlappingSiblingTerritories(input: {
    territoryId: string;
    territoryTypeId: string;
    countryCode: string;
    geoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: string; code: string; overlapRatio: number }>> {
    const geoJsonString = JSON.stringify(input.geoJson);

    const rows = await prisma.$queryRaw<
      Array<{ id: string; code: string; overlap_ratio: number }>
    >`
      WITH child AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT
        t.id,
        t.code,
        CASE
          WHEN ST_Area(child.geom::geography) = 0 THEN 0
          ELSE ST_Area(ST_Intersection(t.boundary, child.geom)::geography)
            / ST_Area(child.geom::geography)
        END AS overlap_ratio
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t."territoryTypeId"
      CROSS JOIN child
      WHERE t.id != ${input.territoryId}
        AND t."isActive" = true
        AND t.boundary IS NOT NULL
        AND t."countryCode" = ${input.countryCode}
        AND t."territoryTypeId" = ${input.territoryTypeId}
        AND tt."blockSiblingOverlap" = true
        AND ST_Intersects(t.boundary, child.geom)
        AND NOT ST_Touches(t.boundary, child.geom)
    `;

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      overlapRatio: Number(row.overlap_ratio),
    }));
  }

  async updateBoundaryMetadata(territoryId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE territories
      SET
        "boundaryMinLng" = bbox.min_lng,
        "boundaryMinLat" = bbox.min_lat,
        "boundaryMaxLng" = bbox.max_lng,
        "boundaryMaxLat" = bbox.max_lat,
        "boundaryAreaSqKm" = bbox.area_sq_km,
        "updatedAt" = NOW()
      FROM (
        SELECT
          ST_XMin(extent)::float AS min_lng,
          ST_YMin(extent)::float AS min_lat,
          ST_XMax(extent)::float AS max_lng,
          ST_YMax(extent)::float AS max_lat,
          ST_Area(boundary::geography) / 1000000 AS area_sq_km
        FROM (
          SELECT boundary, ST_Extent(boundary) AS extent
          FROM territories
          WHERE id = ${territoryId}
            AND boundary IS NOT NULL
        ) bounded
      ) bbox
      WHERE territories.id = ${territoryId}
    `;
  }

  async getClippedBoundaryAsGeoJson(
    operationalTerritoryId: string,
    referenceTerritoryId: string
  ): Promise<GeoJsonGeometry | null> {
    const rows = await prisma.$queryRaw<Array<{ geojson: string | null }>>`
      SELECT ST_AsGeoJSON(
        ST_Intersection(op.boundary, ref.boundary)
      )::text AS geojson
      FROM territories op
      INNER JOIN territories ref ON ref.id = ${referenceTerritoryId}
      WHERE op.id = ${operationalTerritoryId}
        AND op.boundary IS NOT NULL
        AND ref.boundary IS NOT NULL
        AND ST_Intersects(op.boundary, ref.boundary)
    `;

    const raw = rows[0]?.geojson;
    if (!raw) {
      return null;
    }

    const geometry = JSON.parse(raw) as GeoJsonGeometry;
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      return null;
    }

    return geometry;
  }

  async findAssignedClinicsInReferenceTerritory(
    referenceTerritoryId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      territoryId: string;
      operationalTerritoryCode: string;
      operationalTerritoryName: string;
    }>
  > {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        territory_id: string;
        operational_territory_code: string;
        operational_territory_name: string;
      }>
    >`
      SELECT
        c.id,
        c.name,
        c.lat,
        c.lng,
        c."territoryId" AS territory_id,
        op.code AS operational_territory_code,
        op.name AS operational_territory_name
      FROM clinics c
      INNER JOIN territories op ON op.id = c."territoryId"
      INNER JOIN territory_geo_membership m
        ON m."operationalTerritoryId" = op.id
        AND m."referenceTerritoryId" = ${referenceTerritoryId}
      INNER JOIN territories ref ON ref.id = m."referenceTerritoryId"
      WHERE c."deletedAt" IS NULL
        AND c."territoryAssignmentStatus" = 'assigned'::"TerritoryAssignmentStatus"
        AND c.lat IS NOT NULL
        AND c.lng IS NOT NULL
        AND ref.boundary IS NOT NULL
        AND ST_Covers(ref.boundary, ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326))
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      territoryId: row.territory_id,
      operationalTerritoryCode: row.operational_territory_code,
      operationalTerritoryName: row.operational_territory_name,
    }));
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
