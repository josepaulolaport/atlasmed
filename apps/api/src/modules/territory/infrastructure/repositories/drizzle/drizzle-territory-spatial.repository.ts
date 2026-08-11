import { db } from "../../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import { sql } from "drizzle-orm";
import type {
  GeoJsonGeometry,
  OverlappingTerritory,
  TerritoryBoundingBox,
  TerritorySpatialRepository,
  ClinicAssignmentTerritoryMatch,
  SiblingOverlapConflict,
  ManagerZoneCandidate,
} from "../../../application/interfaces/territory-spatial.repository.interface";
import { OperationNotAllowedError } from "../../../../../shared/errors";
import {
  MANAGER_ZONE_TYPE_SLUG,
  REP_PATCH_TYPE_SLUG,
} from "../../../application/constants/territory-roles.constants";

export class DrizzleTerritorySpatialRepository implements TerritorySpatialRepository {
  /**
 * Accepts a transaction handle so spec 0009 R1 can validate a boundary inside
 * the same transaction that later mutates it. Defaults to the shared pool, so
 * every existing caller is unchanged.
 */
  constructor(private readonly database: AnyDatabase = db) {}

  async getBoundaryAsGeoJson(territoryId: number): Promise<GeoJsonGeometry | null> {
    const rows = await this.database.execute(sql`
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
    territoryId: number,
    geoJson: GeoJsonGeometry,
    options?: { repairInvalid?: boolean }
  ): Promise<void> {
    this.assertValidGeometryType(geoJson);

    const geoJsonString = JSON.stringify(geoJson);

    const validation = await this.database.execute(sql`
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

      await this.database.execute(sql`
        UPDATE territories
        SET boundary = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)),
            updated_at = NOW()
        WHERE id = ${territoryId}
      `);
      return;
    }

    await this.database.execute(sql`
      UPDATE territories
      SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326),
          updated_at = NOW()
      WHERE id = ${territoryId}
    `);
  }

  async deleteBoundary(territoryId: number): Promise<void> {
    await this.database.execute(sql`
      UPDATE territories
      SET boundary = NULL,
          updated_at = NOW()
      WHERE id = ${territoryId}
    `);
  }

  async hasBoundary(territoryId: number): Promise<boolean> {
    const rows = await this.database.execute(sql`
      SELECT boundary IS NOT NULL AS has_boundary
      FROM territories
      WHERE id = ${territoryId}
    `) as Array<{ has_boundary: boolean }>;
    return rows[0]?.has_boundary ?? false;
  }

  async getBoundaryBoundingBox(territoryId: number): Promise<TerritoryBoundingBox | null> {
    const rows = await this.database.execute(sql`
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
    territoryId: number,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]> {
    const geoJsonString = JSON.stringify(geoJson);

    const rows = await this.database.execute(sql`
      SELECT t.id, t.code
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE t.id != ${territoryId}
        AND t.is_active = true
        AND t.boundary IS NOT NULL
        AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND ST_Intersects(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
        AND NOT ST_Touches(t.boundary, ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326))
    `) as Array<{ id: number; code: string }>;

    return rows.map((row) => ({ id: Number(row.id), code: row.code }));
  }

  /**
   * Spec 0006: clinic geo membership targets manager zones (not overlapping rep patches).
   */
  async findContainingClinicAssignmentTerritoryIds(
    lng: number,
    lat: number,
    options?: { excludeTerritoryId?: number }
  ): Promise<ClinicAssignmentTerritoryMatch[]> {
    const excludeTerritoryId = options?.excludeTerritoryId ?? null;
    const rows = await this.database.execute(sql`
      SELECT t.id, t.vertical_id
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE t.is_active = true
        AND t.boundary IS NOT NULL
        AND tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
        AND (${excludeTerritoryId}::bigint IS NULL OR t.id != ${excludeTerritoryId})
        AND ST_Covers(
          t.boundary,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
      ORDER BY ST_Area(t.boundary::geography) ASC
    `) as Array<{ id: number; vertical_id: number }>;

    return rows.map((row) => ({
      id: Number(row.id),
      verticalId: Number(row.vertical_id),
    }));
  }

  async userHasRepPatchCoveringFacility(
    userId: number,
    facilityId: number
  ): Promise<boolean> {
    const rows = await this.database.execute(sql`
      SELECT 1 AS ok
      FROM user_territory_assignments uta
      INNER JOIN territories t ON t.id = uta.territory_id
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      INNER JOIN facilities f ON f.id = ${facilityId}
      WHERE uta.user_id = ${userId}
        AND t.is_active = true
        AND t.boundary IS NOT NULL
        AND f.location IS NOT NULL
        AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND ST_Covers(t.boundary, f.location::geometry)
      LIMIT 1
    `) as Array<{ ok: number }>;
    return rows.length > 0;
  }

  async findAssignedClinicsImpactedByBoundary(input: {
    territoryId: number;
    mode: "manager_zone" | "rep_patch";
    geoJson: GeoJsonGeometry;
  }): Promise<
    Array<{
      facilityId: number;
      facilityName: string;
      facilityVerticalProfileId: number;
      consultantUserId: number;
      consultantName: string;
    }>
  > {
    const geoJsonString = JSON.stringify(input.geoJson);

    if (input.mode === "manager_zone") {
      const rows = await this.database.execute(sql`
        WITH proposed AS (
          SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
        )
        SELECT
          f.id AS facility_id,
          f.display_name AS facility_name,
          fvp.id AS facility_vertical_profile_id,
          fvra.user_id AS consultant_user_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.email, fvra.user_id::text) AS consultant_name
        FROM facilities f
        INNER JOIN facility_vertical_profiles fvp
          ON fvp.facility_id = f.id
          AND fvp.is_active = true
          AND fvp.manager_zone_id = ${input.territoryId}
        INNER JOIN facility_vertical_rep_assignments fvra
          ON fvra.facility_vertical_profile_id = fvp.id
          AND fvra.ended_at IS NULL
        INNER JOIN users u ON u.id = fvra.user_id
        CROSS JOIN proposed
        WHERE f.deactivated_at IS NULL
          AND f.location IS NOT NULL
          AND NOT ST_Covers(proposed.geom, f.location::geometry)
      `) as Array<{
        facility_id: string;
        facility_name: string;
        facility_vertical_profile_id: string;
        consultant_user_id: string;
        consultant_name: string;
      }>;

      return rows.map((row) => ({
        facilityId: Number(row.facility_id),
        facilityName: row.facility_name,
        facilityVerticalProfileId: Number(row.facility_vertical_profile_id),
        consultantUserId: Number(row.consultant_user_id),
        consultantName: row.consultant_name,
      }));
    }

    const rows = await this.database.execute(sql`
      WITH proposed AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      ),
      patch_rep AS (
        SELECT uta.user_id, t.vertical_id
        FROM user_territory_assignments uta
        INNER JOIN territories t ON t.id = uta.territory_id
        WHERE uta.territory_id = ${input.territoryId}
        LIMIT 1
      )
      SELECT
        f.id AS facility_id,
        f.display_name AS facility_name,
        fvp.id AS facility_vertical_profile_id,
        fvra.user_id AS consultant_user_id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email, fvra.user_id::text) AS consultant_name
      FROM facilities f
      INNER JOIN patch_rep pr ON true
      INNER JOIN facility_vertical_profiles fvp
        ON fvp.facility_id = f.id
        AND fvp.is_active = true
        AND fvp.vertical_id = pr.vertical_id
      INNER JOIN facility_vertical_rep_assignments fvra
        ON fvra.facility_vertical_profile_id = fvp.id
        AND fvra.ended_at IS NULL
        AND fvra.user_id = pr.user_id
      INNER JOIN users u ON u.id = fvra.user_id
      CROSS JOIN proposed
      WHERE f.deactivated_at IS NULL
        AND f.location IS NOT NULL
        AND NOT ST_Covers(proposed.geom, f.location::geometry)
        AND NOT EXISTS (
          SELECT 1
          FROM user_territory_assignments uta
          INNER JOIN territories t ON t.id = uta.territory_id
          INNER JOIN territory_types tt ON tt.id = t.territory_type_id
          WHERE uta.user_id = pr.user_id
            AND t.id != ${input.territoryId}
            AND t.is_active = true
            AND t.boundary IS NOT NULL
            AND tt.slug = ${REP_PATCH_TYPE_SLUG}
            AND ST_Covers(t.boundary, f.location::geometry)
        )
    `) as Array<{
      facility_id: string;
      facility_name: string;
      facility_vertical_profile_id: string;
      consultant_user_id: string;
      consultant_name: string;
    }>;

    return rows.map((row) => ({
      facilityId: Number(row.facility_id),
      facilityName: row.facility_name,
      facilityVerticalProfileId: Number(row.facility_vertical_profile_id),
      consultantUserId: Number(row.consultant_user_id),
      consultantName: row.consultant_name,
    }));
  }

  async findOverlappingSiblingTerritories(input: {
    territoryId: number;
    territoryTypeId: number;
    geoJson: GeoJsonGeometry;
  }): Promise<SiblingOverlapConflict[]> {
    const geoJsonString = JSON.stringify(input.geoJson);

    const rows = await this.database.execute(sql`
      WITH child AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT
        t.id,
        t.code,
        -- Spec 0009 R3: absolute area, not a share of the proposed polygon. As a
        -- ratio the same sliver read as negligible on a state and alarming on a
        -- city, which is backwards — an overlap is real or it is float noise,
        -- and that does not depend on the size of what it overlaps.
        ST_Area(ST_Intersection(t.boundary, child.geom)::geography) AS overlap_sq_m
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      CROSS JOIN child
      WHERE t.id != ${input.territoryId}
        AND t.is_active = true
        AND t.boundary IS NOT NULL
        AND t.territory_type_id = ${input.territoryTypeId}
        AND t.vertical_id = (
          SELECT source.vertical_id
          FROM territories source
          WHERE source.id = ${input.territoryId}
        )
        AND tt.block_sibling_overlap = true
        AND ST_Intersects(t.boundary, child.geom)
        AND NOT ST_Touches(t.boundary, child.geom)
    `) as Array<{ id: string; code: string; overlap_sq_m: number }>;

    return rows.map((row) => ({
      id: Number(row.id),
      code: row.code,
      overlapSquareMeters: Number(row.overlap_sq_m),
    }));
  }

  async findContainingManagerZones(input: {
    geoJson: GeoJsonGeometry;
    verticalId?: number;
  }): Promise<ManagerZoneCandidate[]> {
    const geoJsonString = JSON.stringify(input.geoJson);
    const verticalId = input.verticalId ?? null;

    const rows = await this.database.execute(sql`
      WITH patch AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326) AS geom
      )
      SELECT t.id, t.code, t.name
      FROM territories t
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      CROSS JOIN patch
      WHERE t.is_active = true
        AND t.boundary IS NOT NULL
        AND tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
        AND (${verticalId}::bigint IS NULL OR t.vertical_id = ${verticalId})
        AND ST_CoveredBy(patch.geom, t.boundary)
      ORDER BY ST_Area(t.boundary::geography) ASC
    `) as Array<{ id: number; code: string; name: string }>;

    return rows.map((row) => ({
      id: Number(row.id),
      code: row.code,
      name: row.name,
    }));
  }

  async findRepPatchesOutsideManagerZone(input: {
    managerZoneId: number;
    managerZoneGeoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: number; code: string }>> {
    const geoJsonString = JSON.stringify(input.managerZoneGeoJson);

    const rows = await this.database.execute(sql`
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
        AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND NOT ST_CoveredBy(p.boundary, zone.geom)
    `) as Array<{ id: number; code: string }>;

    return rows.map((row) => ({ id: Number(row.id), code: row.code }));
  }

  async updateBoundaryMetadata(territoryId: number): Promise<void> {
    await this.database.execute(sql`
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
          ST_XMin(envelope)::float AS min_lng,
          ST_YMin(envelope)::float AS min_lat,
          ST_XMax(envelope)::float AS max_lng,
          ST_YMax(envelope)::float AS max_lat,
          ST_Area(boundary::geography) / 1000000 AS area_sq_km
        FROM (
          SELECT boundary, ST_Envelope(boundary) AS envelope
          FROM territories
          WHERE id = ${territoryId}
            AND boundary IS NOT NULL
        ) bounded
      ) bbox
      WHERE territories.id = ${territoryId}
    `);
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
