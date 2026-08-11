import { db } from "../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import {
  facilities,
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  territories,
} from "@atlasmed/database";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import { MANAGER_ZONE_TYPE_SLUG } from "../../application/constants/territory-roles.constants";
import type {
  ClinicMembershipTarget,
  ClinicMembershipWriter,
  ManagerZoneMembershipRecompute,
} from "../../application/services/territory-membership.service";

export class DrizzleClinicMembershipWriter implements ClinicMembershipWriter {
  /**
   * Accepts a transaction handle so the boundary save can recompute membership
   * inside the transaction that rewrote the geometry (spec 0009 R6). Defaults to
   * the shared pool, leaving the queued and single-clinic callers unchanged.
   */
  constructor(private readonly database: AnyDatabase = db) {}

  async updateProfileTerritoryMemberships(
    facilityId: number,
    memberships: Array<{ verticalId: number; managerZoneId: number | null }>
  ): Promise<void> {
    // Opens a scope on whatever handle we hold: a transaction at the top level,
    // a SAVEPOINT when nested. Opening `db.transaction` unconditionally would
    // take a second connection and deadlock against the caller's FOR UPDATE.
    await this.database.transaction(async (tx) => {
      await tx
        .update(facilityVerticalProfiles)
        .set({
          managerZoneId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(facilityVerticalProfiles.facilityId, facilityId),
            eq(facilityVerticalProfiles.isActive, true)
          )
        );

      for (const membership of memberships) {
        await tx
          .update(facilityVerticalProfiles)
          .set({
            managerZoneId: membership.managerZoneId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(facilityVerticalProfiles.facilityId, facilityId),
              eq(facilityVerticalProfiles.verticalId, membership.verticalId),
              eq(facilityVerticalProfiles.isActive, true)
            )
          );
      }
    });
  }


  async recomputeManagerZoneMembership(
    territoryId: number
  ): Promise<ManagerZoneMembershipRecompute> {
    // One statement, three parts:
    //
    //   affected — the profiles this boundary can move: those pointing at the
    //     territory today (so a shrink releases them) plus those whose clinic
    //     falls in its current bounding box (so a growth claims them).
    //
    //     Deliberately a UNION rather than one scan with an OR. The OR form
    //     cannot use an index for either side, so it seq-scans `facilities` on
    //     every boundary save; split, one branch takes
    //     `facility_vertical_profiles_manager_zone_id_idx` and the other takes
    //     `facilities_location_gist_idx` via `&&`. Both forms measure the same
    //     today (1424 facilities) — this is about not building in a full scan.
    //
    //   matched  — for each, the same-vertical manager zones actually covering
    //     the point. This is `resolveVerticalMatches` expressed in SQL: exactly
    //     one zone wins, zero or several resolve to NULL.
    //   updated  — the write, restricted to rows whose value really changes, so
    //     `changed` is a truthful list and untouched rows keep their timestamp.
    //
    // The trailing SELECT reads the data-modifying CTE's own RETURNING output,
    // so both outcomes come back in a single round trip.
    const rows = (await this.database.execute(sql`
      WITH zone AS (
        SELECT boundary
        FROM territories
        WHERE id = ${territoryId}
      ),
      affected AS (
        SELECT
          fvp.id AS profile_id,
          fvp.facility_id,
          fvp.vertical_id,
          f.location
        FROM facility_vertical_profiles fvp
        INNER JOIN facilities f
          ON f.id = fvp.facility_id
          AND f.deactivated_at IS NULL
        WHERE fvp.is_active = true
          AND fvp.manager_zone_id = ${territoryId}

        UNION

        SELECT
          fvp.id AS profile_id,
          fvp.facility_id,
          fvp.vertical_id,
          f.location
        FROM zone
        INNER JOIN facilities f
          ON f.deactivated_at IS NULL
          AND f.location::geometry && zone.boundary
        INNER JOIN facility_vertical_profiles fvp
          ON fvp.facility_id = f.id
          AND fvp.is_active = true
      ),
      matched AS (
        SELECT
          a.profile_id,
          a.facility_id,
          a.vertical_id,
          count(t.id) AS zone_count,
          min(t.id) AS zone_id,
          array_agg(t.id) FILTER (WHERE t.id IS NOT NULL) AS zone_ids
        FROM affected a
        LEFT JOIN territories t
          ON t.is_active = true
          AND t.boundary IS NOT NULL
          AND t.vertical_id = a.vertical_id
          AND t.territory_type_id = (
            SELECT id FROM territory_types WHERE slug = ${MANAGER_ZONE_TYPE_SLUG}
          )
          AND a.location IS NOT NULL
          AND ST_Covers(t.boundary, a.location::geometry)
        GROUP BY a.profile_id, a.facility_id, a.vertical_id
      ),
      updated AS (
        UPDATE facility_vertical_profiles fvp
        SET
          manager_zone_id = CASE WHEN m.zone_count = 1 THEN m.zone_id ELSE NULL END,
          updated_at = NOW()
        FROM matched m
        WHERE fvp.id = m.profile_id
          AND fvp.manager_zone_id IS DISTINCT FROM
            (CASE WHEN m.zone_count = 1 THEN m.zone_id ELSE NULL END)
        RETURNING fvp.id
      )
      SELECT
        m.profile_id,
        m.facility_id,
        m.vertical_id,
        m.zone_count,
        CASE WHEN m.zone_count = 1 THEN m.zone_id ELSE NULL END AS manager_zone_id,
        COALESCE(m.zone_ids, ARRAY[]::bigint[]) AS zone_ids,
        (m.profile_id IN (SELECT id FROM updated)) AS changed
      FROM matched m
      WHERE m.zone_count > 1
         OR m.profile_id IN (SELECT id FROM updated)
    `)) as Array<{
      profile_id: string;
      facility_id: string;
      vertical_id: string;
      zone_count: string;
      manager_zone_id: string | null;
      zone_ids: string[];
      changed: boolean;
    }>;

    const changed: ManagerZoneMembershipRecompute["changed"] = [];
    const ambiguous: ManagerZoneMembershipRecompute["ambiguous"] = [];

    for (const row of rows) {
      if (row.changed) {
        changed.push({
          facilityVerticalProfileId: Number(row.profile_id),
          facilityId: Number(row.facility_id),
          managerZoneId: row.manager_zone_id == null ? null : Number(row.manager_zone_id),
        });
      }

      if (Number(row.zone_count) > 1) {
        ambiguous.push({
          facilityVerticalProfileId: Number(row.profile_id),
          facilityId: Number(row.facility_id),
          verticalId: Number(row.vertical_id),
          zoneIds: row.zone_ids.map(Number),
        });
      }
    }

    return { changed, ambiguous };
  }

  async findClinicsForMembership(params?: {
    facilityIds?: number[];
    territoryIds?: number[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]> {
    const conditions = [isNull(facilities.deactivatedAt)];

    if (params?.facilityIds?.length) {
      conditions.push(inArray(facilities.id, params.facilityIds));
    }
    if (params?.territoryIds?.length) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM ${facilityVerticalProfiles}
          WHERE ${facilityVerticalProfiles.facilityId} = ${facilities.id}
            AND ${facilityVerticalProfiles.isActive} = true
            AND ${inArray(facilityVerticalProfiles.managerZoneId, params.territoryIds)}
        )`
      );
    }
    if (params?.boundingBox) {
      const { minLng, maxLng, minLat, maxLat } = params.boundingBox;
      conditions.push(
        sql`ST_X(${facilities.location}::geometry) BETWEEN ${minLng} AND ${maxLng}`,
        sql`ST_Y(${facilities.location}::geometry) BETWEEN ${minLat} AND ${maxLat}`
      );
    }

    const rows = await this.database
      .select({
        id: facilities.id,
        lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        managerZoneId: sql<number | null>`(
          SELECT ${facilityVerticalProfiles.managerZoneId}
          FROM ${facilityVerticalProfiles}
          WHERE ${facilityVerticalProfiles.facilityId} = ${facilities.id}
            AND ${facilityVerticalProfiles.isActive} = true
            AND ${facilityVerticalProfiles.managerZoneId} IS NOT NULL
          ORDER BY ${facilityVerticalProfiles.updatedAt} DESC
          LIMIT 1
        )`,
      })
      .from(facilities)
      .where(and(...conditions));

    return rows;
  }

  async findClinicsWithoutConsultant(params: {
    managerZoneIds?: number[];
    global: boolean;
  }): Promise<
    Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }>
  > {
    if (!params.global && !params.managerZoneIds?.length) {
      return [];
    }

    const zoneFilter =
      !params.global && params.managerZoneIds?.length
        ? inArray(facilityVerticalProfiles.managerZoneId, params.managerZoneIds)
        : sql`${facilityVerticalProfiles.managerZoneId} IS NOT NULL`;

    const rows = await this.database
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        managerZoneId: facilityVerticalProfiles.managerZoneId,
        managerZoneName: territories.name,
      })
      .from(facilities)
      .innerJoin(
        facilityVerticalProfiles,
        and(
          eq(facilityVerticalProfiles.facilityId, facilities.id),
          eq(facilityVerticalProfiles.isActive, true),
          zoneFilter,
        ),
      )
      .leftJoin(
        territories,
        eq(territories.id, facilityVerticalProfiles.managerZoneId),
      )
      .where(
        and(
          isNull(facilities.deactivatedAt),
          sql`NOT EXISTS (
            SELECT 1
            FROM ${facilityVerticalRepAssignments}
            WHERE ${facilityVerticalRepAssignments.facilityVerticalProfileId} = ${facilityVerticalProfiles.id}
              AND ${facilityVerticalRepAssignments.endedAt} IS NULL
          )`,
        ),
      );

    const seen = new Set<number>();
    const unique: Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }> = [];

    for (const row of rows) {
      if (!row.managerZoneId || seen.has(row.id)) continue;
      seen.add(row.id);
      unique.push({
        id: row.id,
        displayName: row.displayName,
        lat: row.lat,
        lng: row.lng,
        managerZoneId: row.managerZoneId,
        managerZoneName: row.managerZoneName,
      });
    }

    return unique;
  }
}
