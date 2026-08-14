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
