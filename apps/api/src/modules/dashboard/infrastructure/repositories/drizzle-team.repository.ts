import { orders } from "@atlasmed/database";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";

/** Kept local, as the scope repository does, to avoid a composition cycle. */
const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
const REP_PATCH_TYPE_SLUG = "patch";

/**
 * Every metric a roster row can show, for one person.
 *
 * Percentages are null when the denominator is empty — the same rule the
 * Desempenho cards follow, so a person with no clinics reads as "no figure"
 * rather than as 0%.
 */
export type TeamMemberMetrics = {
  assignedClinics: number;
  coveragePercent: number | null;
  cadastroPercent: number | null;
  ordersMonth: number;
};

/**
 * One person, as the member profile reads them (spec 0015 §4).
 *
 * Deliberately excludes `birth_date`: personal, and no decision on this screen
 * turns on it. `last_login_at` is left out for a different reason — see §4.1;
 * it is maintained, but with long-lived sessions a daily user can look dormant
 * for weeks, so showing it would mislead more than it informs.
 */
export type TeamMemberProfile = TeamMemberRow & {
  phoneNumber: string | null;
  status: string;
  memberSince: string;
  /**
   * Active assignments carrying an override — clinics this person holds that
   * no patch of theirs covers (spec 0009 R2, I2's second limb).
   *
   * Zone-scoped like every other figure here: an override on ground another
   * manager owns is that manager's business, not this reader's.
   */
  outOfTerritoryCount: number;
};

/** A clinic that could be given to someone (spec 0015 R6). */
export type AssignableClinicRow = {
  facilityId: number;
  name: string;
  city: string;
  state: string;
  /** Who holds it now, if anyone — the confirmation has to name them. */
  currentRepName: string | null;
  currentRepId: number | null;
  /**
   * True when no patch of theirs covers it, so I2 needs an override instead of
   * geometry. Decided server-side: the client cannot see the polygons.
   */
  requiresReason: boolean;
};

export type TeamMemberRow = {
  userId: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  roleName: string;
  /** Territories this member holds in the vertical. */
  territories: Array<{ id: number; name: string }>;
  /** Active profiles this member holds directly. Zero for a manager. */
  assignedClinicCount: number;
};

/**
 * The Equipe roster (spec 0014 §6).
 *
 * Membership is territory-derived, never `users.manager_id`: a rep may hold
 * patches under two managers, and the ownership model is geometric throughout
 * (spec 0009). A roster built on a denormalised manager column would disagree
 * with every other count on the screen.
 */
export class DrizzleTeamRepository {
  /** Managers holding at least one active zone in this vertical — the admin roster. */
  async listManagers(verticalId: number): Promise<TeamMemberRow[]> {
    return this.query(sql`
      SELECT u.id,
             NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
             u.email,
             u.avatar_url,
             r.name AS role_name,
             COALESCE(
               JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'name', t.name))
                 FILTER (WHERE t.id IS NOT NULL),
               '[]'
             ) AS territories,
             0 AS assigned_clinic_count
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      INNER JOIN user_territory_assignments uta ON uta.user_id = u.id
      INNER JOIN territories t ON t.id = uta.territory_id
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE u.deleted_at IS NULL
        AND t.vertical_id = ${verticalId}
        AND t.is_active = true
        AND tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.avatar_url, r.name
      ORDER BY name NULLS LAST, u.id
    `);
  }

  /**
   * REPs holding an active patch under these manager zones.
   *
   * `assigned_clinic_count` counts open rep assignments on live, active
   * profiles **inside these zones**. The zone predicate is the point: a rep may
   * hold patches under two managers, and an unscoped count would show each of
   * them clinics the other is accountable for — numbers they cannot act on, and
   * which would not add up to their own roster header.
   */
  async listRepsUnderZones(input: {
    verticalId: number;
    zoneIds: number[];
  }): Promise<TeamMemberRow[]> {
    if (input.zoneIds.length === 0) return [];

    const zones = sql.join(
      input.zoneIds.map((id) => sql`${id}`),
      sql`, `,
    );

    return this.query(sql`
      SELECT u.id,
             NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
             u.email,
             u.avatar_url,
             r.name AS role_name,
             COALESCE(
               JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'name', t.name))
                 FILTER (WHERE t.id IS NOT NULL),
               '[]'
             ) AS territories,
             (SELECT COUNT(*)
                FROM facility_vertical_rep_assignments a
                INNER JOIN facility_vertical_profiles p
                  ON p.id = a.facility_vertical_profile_id
                INNER JOIN facilities f ON f.id = p.facility_id
               WHERE a.user_id = u.id
                 AND a.ended_at IS NULL
                 AND p.vertical_id = ${input.verticalId}
                 AND p.is_active = true
                 AND f.deactivated_at IS NULL
                 -- Spec 0015 R1: this manager's share of the rep, not the whole
                 -- person. Without it a rep working under two managers shows
                 -- each of them the other's clinics.
                 AND p.manager_zone_id IN (${zones}))::int AS assigned_clinic_count
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      INNER JOIN user_territory_assignments uta ON uta.user_id = u.id
      INNER JOIN territories t ON t.id = uta.territory_id
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE u.deleted_at IS NULL
        AND t.vertical_id = ${input.verticalId}
        AND t.is_active = true
        AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND t.manager_territory_id IN (${zones})
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.avatar_url, r.name
      ORDER BY name NULLS LAST, u.id
    `);
  }

  /**
   * Every row metric for a whole roster, in one pass.
   *
   * Equipe used to compute **one** metric per member by calling a metric use
   * case once per person — N+1 by construction, and it forced the screen to let
   * you see only the metric you had sorted by. Comparing people on two things
   * meant sorting twice and holding the first read in your head.
   *
   * One statement for the roster is both cheaper than that and richer: the
   * marginal cost of a second and third `COUNT(*) FILTER` over a set already
   * being scanned is close to nothing, so the screen can show several at once
   * and sorting goes back to meaning *order*.
   *
   * The denominators differ by role and that difference is the point of spec
   * 0014 §3 — a rep is measured on the clinics **assigned** to them, a manager
   * on the clinics **in their zones**. Only the head of the query changes; every
   * count below it is shared, so the two can never drift apart.
   */
  async findMemberMetrics(input: {
    verticalId: number;
    userIds: number[];
    scope: "rep" | "manager";
    /**
     * Spec 0015 R1 — the zones the reader is accountable for, narrowing a rep's
     * figures to their share of that person. Null only for a viewer with
     * authority everywhere, which is the one case where the whole rep is the
     * honest answer.
     *
     * Unused by the manager scope, whose zones are the members' own.
     */
    withinZoneIds?: number[] | null;
    /** Half-open, for the orders count. */
    ordersFrom: Date;
    ordersTo: Date;
  }): Promise<Map<number, TeamMemberMetrics>> {
    if (input.userIds.length === 0) return new Map();
    // An empty list is "no zones", not "every zone" — the `IN ()` widening trap
    // that would hand a manager with no ground the whole country.
    if (input.scope === "rep" && input.withinZoneIds?.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      input.userIds.map((id) => sql`${id}`),
      sql`, `,
    );
    // A `Date` inside a raw template never reaches the column's encoder, and
    // postgres-js rejects it at Bind time. Same trap as `countOrders`.
    const from = orders.orderedAt.mapToDriverValue(input.ordersFrom) as string;
    const to = orders.orderedAt.mapToDriverValue(input.ordersTo) as string;

    const withinZones =
      input.scope === "rep" && input.withinZoneIds?.length
        ? sql` AND p.manager_zone_id IN (${sql.join(
            input.withinZoneIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;

    const scoped =
      input.scope === "rep"
        ? sql`
            SELECT a.user_id, p.id AS profile_id
              FROM facility_vertical_rep_assignments a
              JOIN facility_vertical_profiles p
                ON p.id = a.facility_vertical_profile_id
              JOIN facilities f ON f.id = p.facility_id
             WHERE a.ended_at IS NULL
               AND a.user_id IN (${ids})
               AND p.vertical_id = ${input.verticalId}
               AND p.is_active = true
               AND f.deactivated_at IS NULL${withinZones}`
        : sql`
            SELECT uta.user_id, p.id AS profile_id
              FROM user_territory_assignments uta
              JOIN territories z
                ON z.id = uta.territory_id AND z.is_active = true
              JOIN territory_types tt
                ON tt.id = z.territory_type_id AND tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
              JOIN facility_vertical_profiles p ON p.manager_zone_id = z.id
              JOIN facilities f ON f.id = p.facility_id
             WHERE uta.user_id IN (${ids})
               AND z.vertical_id = ${input.verticalId}
               AND p.is_active = true
               AND f.deactivated_at IS NULL`;

    const rows = (await db.execute(sql`
      WITH scoped AS (${scoped}),
      profile_stats AS (
        SELECT s.user_id,
               COUNT(*)::int AS assigned,
               COUNT(*) FILTER (
                 WHERE p.purchase_funnel_stage
                   IN ('PURCHASE_WINDOW', 'OUTSIDE_WINDOW', 'CHURN')
               )::int AS covered,
               COUNT(*) FILTER (
                 WHERE p.conformity_status = 'REGISTERED'
               )::int AS registered
          FROM scoped s
          JOIN facility_vertical_profiles p ON p.id = s.profile_id
         GROUP BY s.user_id
      ),
      order_stats AS (
        SELECT s.user_id, COUNT(*)::int AS orders
          FROM scoped s
          JOIN ${orders} o ON o.facility_vertical_profile_id = s.profile_id
         WHERE o.status IN ('APPROVED', 'INVOICED')
           AND o.type IN ('SALE', 'CONSIGNMENT')
           AND o.ordered_at >= ${from}::timestamp
           AND o.ordered_at <  ${to}::timestamp
         GROUP BY s.user_id
      )
      SELECT ps.user_id,
             ps.assigned,
             ps.covered,
             ps.registered,
             COALESCE(os.orders, 0) AS orders
        FROM profile_stats ps
        LEFT JOIN order_stats os ON os.user_id = ps.user_id
    `)) as unknown as Array<{
      user_id: number | string;
      assigned: number | string;
      covered: number | string;
      registered: number | string;
      orders: number | string;
    }>;

    const byUser = new Map<number, TeamMemberMetrics>();
    for (const row of rows) {
      const assigned = Number(row.assigned);
      byUser.set(Number(row.user_id), {
        assignedClinics: assigned,
        // Null rather than 0 when there is nothing to divide: a person with no
        // clinics has no coverage figure, and 0% reads as failure rather than
        // absence — the same rule the cards follow.
        coveragePercent: assigned > 0 ? Number(row.covered) / assigned : null,
        cadastroPercent:
          assigned > 0 ? Number(row.registered) / assigned : null,
        ordersMonth: Number(row.orders),
      });
    }
    return byUser;
  }

  /**
   * One member, for the profile screen (spec 0015 §4).
   *
   * `withinZoneIds` narrows the territories, the clinic count and the
   * out-of-territory count to the reader's ground — the same predicate the
   * roster row used (R1), so the number on the row and the number on the
   * profile it opens are the same number by construction.
   *
   * Null means a reader with authority everywhere, for whom the whole person is
   * the honest answer.
   */
  async findMember(input: {
    userId: number;
    verticalId: number;
    withinZoneIds: number[] | null;
  }): Promise<TeamMemberProfile | null> {
    const zones = input.withinZoneIds;
    if (zones?.length === 0) return null;

    const zoneList = zones?.length
      ? sql.join(
          zones.map((id) => sql`${id}`),
          sql`, `,
        )
      : null;

    // Patches are filtered to the reader's zones so the profile never names a
    // territory the reader has no authority over. Manager zones are the
    // reader's own ground by definition and need no such filter.
    const territoryScope = zoneList
      ? sql` AND (tt.slug <> ${REP_PATCH_TYPE_SLUG} OR t.manager_territory_id IN (${zoneList}))`
      : sql``;
    const profileScope = zoneList
      ? sql` AND p.manager_zone_id IN (${zoneList})`
      : sql``;

    const rows = (await db.execute(sql`
      SELECT u.id,
             NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
             u.email,
             u.phone_number,
             u.avatar_url,
             u.status,
             u.created_at AS member_since,
             r.name AS role_name,
             COALESCE(
               (SELECT JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'name', t.name))
                  FROM user_territory_assignments uta
                  INNER JOIN territories t ON t.id = uta.territory_id
                  INNER JOIN territory_types tt ON tt.id = t.territory_type_id
                 WHERE uta.user_id = u.id
                   AND t.vertical_id = ${input.verticalId}
                   AND t.is_active = true${territoryScope}),
               '[]'
             ) AS territories,
             (SELECT COUNT(*)
                FROM facility_vertical_rep_assignments a
                INNER JOIN facility_vertical_profiles p
                  ON p.id = a.facility_vertical_profile_id
                INNER JOIN facilities f ON f.id = p.facility_id
               WHERE a.user_id = u.id
                 AND a.ended_at IS NULL
                 AND p.vertical_id = ${input.verticalId}
                 AND p.is_active = true
                 AND f.deactivated_at IS NULL${profileScope})::int
               AS assigned_clinic_count,
             (SELECT COUNT(*)
                FROM facility_vertical_rep_assignments a
                INNER JOIN facility_vertical_profiles p
                  ON p.id = a.facility_vertical_profile_id
                INNER JOIN facilities f ON f.id = p.facility_id
               WHERE a.user_id = u.id
                 AND a.ended_at IS NULL
                 AND a.override_reason IS NOT NULL
                 AND p.vertical_id = ${input.verticalId}
                 AND p.is_active = true
                 AND f.deactivated_at IS NULL${profileScope})::int
               AS out_of_territory_count
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${input.userId}
        AND u.deleted_at IS NULL
    `)) as unknown as Array<{
      id: number | string;
      name: string | null;
      email: string;
      phone_number: string | null;
      avatar_url: string | null;
      status: string;
      member_since: Date | string;
      role_name: string;
      territories: Array<{ id: number; name: string }> | string;
      assigned_clinic_count: number | string;
      out_of_territory_count: number | string;
    }>;

    const row = rows[0];
    if (!row) return null;

    return {
      userId: Number(row.id),
      name: row.name,
      email: row.email,
      phoneNumber: row.phone_number,
      avatarUrl: row.avatar_url,
      roleName: row.role_name,
      status: row.status,
      memberSince: new Date(row.member_since).toISOString(),
      territories:
        typeof row.territories === "string"
          ? (JSON.parse(row.territories) as Array<{ id: number; name: string }>)
          : row.territories,
      assignedClinicCount: Number(row.assigned_clinic_count),
      outOfTerritoryCount: Number(row.out_of_territory_count),
    };
  }

  /**
   * Clinics this rep could be given (spec 0015 R6).
   *
   * Two doors, one query. `mode: "patch"` offers the unassigned clinics their
   * own patches cover — the common case, and the one that needs no
   * justification. `mode: "search"` offers anything in the vertical, including
   * clinics someone else holds, because taking one over is a real operation and
   * hiding it produces the workaround spec 0009 R2 warns about: a throwaway
   * patch drawn around the clinic.
   *
   * `requiresReason` is computed here rather than inferred by the client. It is
   * exactly I2's second limb — no patch of theirs covers this point — so the
   * screen can ask for a sentence at the right moment without re-deriving
   * geometry it cannot see.
   *
   * Patch membership is resolved by `ST_Covers` at request time. Nothing
   * materialises it (only `manager_zone_id` is stored), and this is a cold path
   * — reached when someone opens the screen, not on every dashboard card — so a
   * derived column would be one more thing to keep true through every edit.
   */
  async listAssignableClinics(input: {
    userId: number;
    verticalId: number;
    mode: "patch" | "search";
    search?: string | null;
    /** The reader's ground; patches outside it are not theirs to staff. */
    withinZoneIds: number[] | null;
    offset: number;
    limit: number;
  }): Promise<{ rows: AssignableClinicRow[]; total: number }> {
    if (input.withinZoneIds?.length === 0) return { rows: [], total: 0 };

    const zoneFilter = input.withinZoneIds?.length
      ? sql` AND t.manager_territory_id IN (${sql.join(
          input.withinZoneIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

    // The union of their patches, once, so the covers test runs against one
    // geometry rather than once per polygon.
    const patches = sql`
      SELECT ST_Union(t.boundary::geometry) AS area
        FROM user_territory_assignments uta
        JOIN territories t ON t.id = uta.territory_id AND t.is_active = true
        JOIN territory_types tt
          ON tt.id = t.territory_type_id AND tt.slug = ${REP_PATCH_TYPE_SLUG}
       WHERE uta.user_id = ${input.userId}
         AND t.vertical_id = ${input.verticalId}${zoneFilter}
    `;

    const term = input.search?.trim();
    const searchFilter = term
      ? sql` AND f.name ILIKE ${`%${term}%`}`
      : sql``;

    // "Unassigned" only matters for the patch door. The search door must offer
    // held clinics too, or takeover is unreachable.
    const heldFilter =
      input.mode === "patch"
        ? sql` AND NOT EXISTS (
              SELECT 1 FROM facility_vertical_rep_assignments a
               WHERE a.facility_vertical_profile_id = p.id
                 AND a.ended_at IS NULL)`
        : sql``;

    const coverageFilter =
      input.mode === "patch"
        ? sql` AND patch.area IS NOT NULL AND ST_Covers(patch.area, f.location::geometry)`
        : sql``;

    const rows = (await db.execute(sql`
      WITH patch AS (${patches})
      SELECT f.id AS facility_id,
             f.name AS name,
             m.name AS city,
             s.abbreviation AS state,
             (SELECT NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '')
                FROM facility_vertical_rep_assignments a
                JOIN users u ON u.id = a.user_id
               WHERE a.facility_vertical_profile_id = p.id
                 AND a.ended_at IS NULL
               LIMIT 1) AS current_rep_name,
             (SELECT a.user_id
                FROM facility_vertical_rep_assignments a
               WHERE a.facility_vertical_profile_id = p.id
                 AND a.ended_at IS NULL
               LIMIT 1) AS current_rep_id,
             NOT (patch.area IS NOT NULL
                  AND ST_Covers(patch.area, f.location::geometry))
               AS requires_reason,
             COUNT(*) OVER ()::int AS total
        FROM facility_vertical_profiles p
        JOIN facilities f ON f.id = p.facility_id
        JOIN municipalities m ON m.id = f.municipality_id
        JOIN states s ON s.id = f.state_id
        CROSS JOIN patch
       WHERE p.vertical_id = ${input.verticalId}
         AND p.is_active = true
         AND f.deactivated_at IS NULL${heldFilter}${coverageFilter}${searchFilter}
       ORDER BY f.name, f.id
       OFFSET ${input.offset} LIMIT ${input.limit}
    `)) as unknown as Array<{
      facility_id: number | string;
      name: string;
      city: string;
      state: string;
      current_rep_name: string | null;
      current_rep_id: number | string | null;
      requires_reason: boolean;
      total: number | string;
    }>;

    return {
      total: Number(rows[0]?.total ?? 0),
      rows: rows.map((row) => ({
        facilityId: Number(row.facility_id),
        name: row.name,
        city: row.city,
        state: row.state,
        currentRepName: row.current_rep_name,
        currentRepId:
          row.current_rep_id == null ? null : Number(row.current_rep_id),
        requiresReason: row.requires_reason,
      })),
    };
  }

  /**
   * REPs with no active patch anywhere (spec 0009 R8/D9, surfaced by 0014 §6).
   *
   * Such a rep has no manager, appears on no team, and can hold no clinics.
   * Without this roster that state is not merely invisible — it looks like an
   * empty team rather than a person nobody is accountable for.
   *
   * Deliberately not vertical-scoped: the whole point is a rep who belongs to
   * no territory, and filtering by vertical would hide exactly the rows that
   * matter.
   */
  async listRepsWithoutPatch(): Promise<TeamMemberRow[]> {
    return this.query(sql`
      SELECT u.id,
             NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
             u.email,
             u.avatar_url,
             r.name AS role_name,
             '[]'::json AS territories,
             0 AS assigned_clinic_count
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.deleted_at IS NULL
        AND r.name = 'REP'
        AND NOT EXISTS (
          SELECT 1
            FROM user_territory_assignments uta
            INNER JOIN territories t ON t.id = uta.territory_id
            INNER JOIN territory_types tt ON tt.id = t.territory_type_id
           WHERE uta.user_id = u.id
             AND t.is_active = true
             AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        )
      ORDER BY name NULLS LAST, u.id
    `);
  }

  private async query(statement: ReturnType<typeof sql>): Promise<TeamMemberRow[]> {
    const rows = (await db.execute(statement)) as Array<{
      id: number | string;
      name: string | null;
      email: string;
      avatar_url: string | null;
      role_name: string;
      territories: Array<{ id: number; name: string }> | string;
      assigned_clinic_count: number | string;
    }>;

    return rows.map((row) => ({
      userId: Number(row.id),
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url,
      roleName: row.role_name,
      territories:
        typeof row.territories === "string"
          ? (JSON.parse(row.territories) as Array<{ id: number; name: string }>)
          : row.territories,
      assignedClinicCount: Number(row.assigned_clinic_count),
    }));
  }
}
