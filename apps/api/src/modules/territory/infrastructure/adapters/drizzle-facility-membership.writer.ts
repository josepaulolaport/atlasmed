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
  UnassignedClinic,
  UnassignedClinicReason,
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

  async findClinicsNeedingRep(params: {
    managerZoneIds?: number[];
    global: boolean;
    offset: number;
    limit: number;
  }): Promise<{ rows: UnassignedClinic[]; total: number }> {
    const zoneIds = params.managerZoneIds ?? [];
    if (!params.global && zoneIds.length === 0) {
      return { rows: [], total: 0 };
    }

    // Paginated in SQL. The previous version fetched every matching clinic and
    // sliced in memory, so each page cost a full scan — tolerable for a queue
    // someone checks occasionally, not for a performance screen loaded per
    // manager. `count(*) OVER ()` keeps the total exact without a second query.
    // Bound as a comma-separated string and parsed in SQL: the driver cannot
    // encode a JS array against an explicit `::bigint[]` cast. Values are ids
    // resolved from the caller's scope, and non-numbers are dropped before they
    // reach the query.
    const zoneIdCsv = zoneIds.filter((id) => Number.isFinite(id)).join(",");

    const rows = (await this.database.execute(sql`
      WITH scope AS (
        SELECT COALESCE(
          string_to_array(NULLIF(${zoneIdCsv}, ''), ',')::bigint[],
          ARRAY[]::bigint[]
        ) AS zone_ids
      ),
      candidate AS (
        SELECT
          fvp.id AS profile_id,
          fvp.facility_id,
          fvp.vertical_id,
          fvp.manager_zone_id,
          f.name AS display_name,
          f.location
        FROM facility_vertical_profiles fvp
        INNER JOIN facilities f
          ON f.id = fvp.facility_id
          AND f.deactivated_at IS NULL
        WHERE fvp.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM facility_vertical_rep_assignments fvra
            WHERE fvra.facility_vertical_profile_id = fvp.id
              AND fvra.ended_at IS NULL
          )
      ),
      -- Which zones cover a clinic that has none assigned. This is the same
      -- ST_Covers predicate the membership recompute uses, so "contested" here
      -- means exactly what it means there.
      covering AS (
        SELECT c.profile_id, array_agg(t.id ORDER BY t.id) AS zone_ids
        FROM candidate c
        INNER JOIN territories t
          ON t.is_active = true
          AND t.boundary IS NOT NULL
          AND t.vertical_id = c.vertical_id
          AND t.territory_type_id = (
            SELECT id FROM territory_types WHERE slug = ${MANAGER_ZONE_TYPE_SLUG}
          )
          AND ST_Covers(t.boundary, c.location::geometry)
        WHERE c.manager_zone_id IS NULL
          AND c.location IS NOT NULL
        GROUP BY c.profile_id
      ),
      classified AS (
        SELECT
          c.*,
          COALESCE(cv.zone_ids, ARRAY[]::bigint[]) AS candidate_zone_ids,
          CASE
            WHEN c.manager_zone_id IS NOT NULL THEN 'no_consultant'
            WHEN COALESCE(array_length(cv.zone_ids, 1), 0) >= 2 THEN 'ambiguous_zone'
            ELSE 'no_zone'
          END AS reason
        FROM candidate c
        LEFT JOIN covering cv ON cv.profile_id = c.profile_id
      )
      SELECT
        cl.profile_id,
        cl.facility_id,
        cl.vertical_id,
        cl.display_name,
        ST_Y(cl.location::geometry) AS lat,
        ST_X(cl.location::geometry) AS lng,
        cl.reason,
        cl.manager_zone_id,
        cl.candidate_zone_ids,
        z.name AS manager_zone_name,
        count(*) OVER () AS total
      FROM classified cl
      LEFT JOIN territories z ON z.id = cl.manager_zone_id
      -- Visibility, not filtering-after-the-fact: a manager sees a clinic that
      -- is in one of their zones, or that one of their zones covers when no zone
      -- owns it. A clinic nothing covers reaches only a global caller — there is
      -- no manager it could belong to.
      CROSS JOIN scope s
      WHERE ${params.global}
        OR cl.manager_zone_id = ANY(s.zone_ids)
        OR cl.candidate_zone_ids && s.zone_ids
      ORDER BY cl.facility_id, cl.profile_id
      LIMIT ${params.limit} OFFSET ${params.offset}
    `)) as Array<{
      profile_id: string;
      facility_id: string;
      vertical_id: string;
      display_name: string;
      lat: number | null;
      lng: number | null;
      reason: UnassignedClinicReason;
      manager_zone_id: string | null;
      candidate_zone_ids: string[];
      manager_zone_name: string | null;
      total: string;
    }>;

    return {
      total: rows.length > 0 ? Number(rows[0]!.total) : 0,
      rows: rows.map((row) => ({
        facilityId: Number(row.facility_id),
        facilityVerticalProfileId: Number(row.profile_id),
        verticalId: Number(row.vertical_id),
        displayName: row.display_name,
        lat: row.lat == null ? null : Number(row.lat),
        lng: row.lng == null ? null : Number(row.lng),
        reason: row.reason,
        managerZoneId: row.manager_zone_id == null ? null : Number(row.manager_zone_id),
        managerZoneName: row.manager_zone_name,
        candidateZoneIds: row.candidate_zone_ids.map(Number),
      })),
    };
  }
}
