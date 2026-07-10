import { db } from "../../../../../infrastructure/database/db";
import { sql } from "drizzle-orm";
import type {
  GeoJsonGeometry,
  OverlappingTerritory,
  TerritoryBoundingBox,
  TerritorySpatialRepository,
} from "../../../application/interfaces/territory-spatial.repository.interface";
import { OperationNotAllowedError } from "../../../../../shared/errors";
import { MANAGER_ZONE_TYPE_SLUG } from "../../../application/constants/territory-roles.constants";

export class PrismaTerritorySpatialRepository implements TerritorySpatialRepository {
  async getBoundaryAsGeoJson(territoryId: string): Promise<GeoJsonGeometry | null> {
    const rows = await db.execute(sql`
      SELECT ST_AsGeoJSON(boundary)::text AS geojson
      FROM territories
      WHERE id = ${territoryId}
        AND boundary IS NOT NULL
    `) as Array<{ geojson: string | null }>;

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

    const validation = await db.execute(sql`
      SELECT
        ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS is_valid,
        ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)) AS reason
    `) as Array<{ is_valid: boolean; reason: string | null }>;

    if (!validation[0]?.is_valid) {
      if (!options?.repairInvalid) {
        throw new OperationNotAllowedError(
          "save_boundary",
          validation[0]?.reason ?? "Invalid geometry"
        );
      }

      await db.execute(sql`
        UPDATE territories
        SET boundary = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)),
            updated_at = NOW()
        WHERE id = ${territoryId}
      `);
      return;
    }

    await db.execute(sql`
      UPDATE territories
      SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326),
          updated_at = NOW()
      WHERE id = ${territoryId}
    `);
  }

  async deleteBoundary(territoryId: string): Promise<void> {
    await db.execute(sql`
      UPDATE territories
      SET boundary = NULL,
          updated_at = NOW()
      WHERE id = ${territoryId}
    `);
  }

  async hasBoundary(territoryId: string): Promise<boolean> {
    const rows = await db.execute(sql`
      SELECT boundary IS NOT NULL AS has_boundary
      FROM territories
      WHERE id = ${territoryId}
    `) as Array<{ has_boundary: boolean }>;
    return rows[0]?.has_boundary ?? false;
  }

  async getBoundaryBoundingBox(territoryId: string): Promise<TerritoryBoundingBox | null> {
    const rows = await db.execute(sql`
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
    `) as Array<{
      min_lng: number | null;
      min_lat: number | null;
      max_lng: number | null;
      max_lat: number | null;
    }>;

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

    return db.execute(sql`
      SELECT t.id, t.code
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE t.id != ${territoryId}
        AND t.is_active = true
        AND t.boundary IS NOT NULL
        AND tt.assigns_clinics = true
        AND ST_Intersects(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
        AND NOT ST_Touches(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
    `) as Promise<Array<{ id: string; code: string }>>;
  }

  async findContainingClinicAssignmentTerritoryIds(lng: number, lat: number): Promise<string[]> {
    const rows = await db.execute(sql`
      SELECT t.id
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE t.is_active = true
        AND t.boundary IS NOT NULL
        AND tt.assigns_clinics = true
        AND ST_Covers(
          t.boundary,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
      ORDER BY ST_Area(t.boundary::geography) ASC
    `) as Array<{ id: string }>;

    return rows.map((row) => row.id);
  }

  async findOverlappingSiblingTerritories(input: {
    territoryId: string;
    territoryTypeId: string;
    countryCode: string;
    geoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: string; code: string; overlapRatio: number }>> {
    const geoJsonString = JSON.stringify(input.geoJson);

    const rows = await db.execute(sql`
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
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      CROSS JOIN child
      WHERE t.id != ${input.territoryId}
        AND t.is_active = true
        AND t.boundary IS NOT NULL
        AND t.country_code = ${input.countryCode}
        AND t.territory_type_id = ${input.territoryTypeId}
        AND tt.block_sibling_overlap = true
        AND ST_Intersects(t.boundary, child.geom)
        AND NOT ST_Touches(t.boundary, child.geom)
    `) as Array<{ id: string; code: string; overlap_ratio: number }>;

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      overlapRatio: Number(row.overlap_ratio),
    }));
  }

  async findContainingManagerZones(input: {
    geoJson: GeoJsonGeometry;
    countryCode: string;
  }): Promise<Array<{ id: string; code: string; name: string }>> {
    const geoJsonString = JSON.stringify(input.geoJson);

    return db.execute(sql`
      WITH patch AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT t.id, t.code, t.name
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      CROSS JOIN patch
      WHERE t.is_active = true
        AND t.boundary IS NOT NULL
        AND t.country_code = ${input.countryCode}
        AND tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
        AND ST_CoveredBy(patch.geom, t.boundary)
      ORDER BY ST_Area(t.boundary::geography) ASC
    `) as Promise<Array<{ id: string; code: string; name: string }>>;
  }

  async findRepPatchesOutsideManagerZone(input: {
    managerZoneId: string;
    managerZoneGeoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: string; code: string }>> {
    const geoJsonString = JSON.stringify(input.managerZoneGeoJson);

    return db.execute(sql`
      WITH zone AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT p.id, p.code
      FROM territories p
      INNER JOIN territory_types tt ON tt.id = p.territory_type_id
      CROSS JOIN zone
      WHERE p.manager_territory_id = ${input.managerZoneId}
        AND p.is_active = true
        AND p.boundary IS NOT NULL
        AND tt.assigns_clinics = true
        AND NOT ST_CoveredBy(p.boundary, zone.geom)
    `) as Promise<Array<{ id: string; code: string }>>;
  }

  async updateBoundaryMetadata(territoryId: string): Promise<void> {
    await db.execute(sql`
      UPDATE territories
      SET
        boundary_min_lng = bbox.min_lng,
        boundary_min_lat = bbox.min_lat,
        boundary_max_lng = bbox.max_lng,
        boundary_max_lat = bbox.max_lat,
        boundary_area_sq_km = bbox.area_sq_km,
        updated_at = NOW()
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
    `);
  }

  async findAssignedClinicsInGroupingTerritory(input: {
    groupingTerritoryId: string;
    scopedPatchIds: string[];
  }): Promise<
    Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      territoryId: string;
      repPatchCode: string;
      repPatchName: string;
    }>
  > {
    if (input.scopedPatchIds.length === 0) {
      return [];
    }

    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        ST_Y(c.location::geometry) AS lat,
        ST_X(c.location::geometry) AS lng,
        c.territory_id,
        patch.code AS rep_patch_code,
        patch.name AS rep_patch_name
      FROM facilities c
      INNER JOIN territories patch ON patch.id = c.territory_id
      INNER JOIN territories grp ON grp.id = ${input.groupingTerritoryId}
      WHERE c.deactivated_at IS NULL
        AND c.territory_assignment_status = 'assigned'::territory_assignment_status
        AND c.location IS NOT NULL
        AND c.territory_id = ANY(${input.scopedPatchIds})
        AND grp.boundary IS NOT NULL
        AND ST_X(c.location::geometry) BETWEEN grp.boundary_min_lng AND grp.boundary_max_lng
        AND ST_Y(c.location::geometry) BETWEEN grp.boundary_min_lat AND grp.boundary_max_lat
        AND ST_Covers(grp.boundary, ST_SetSRID(ST_MakePoint(ST_X(c.location::geometry), ST_Y(c.location::geometry)), 4326))
    `) as Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      territory_id: string;
      rep_patch_code: string;
      rep_patch_name: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      territoryId: row.territory_id,
      repPatchCode: row.rep_patch_code,
      repPatchName: row.rep_patch_name,
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
