import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";

/** Kept local, as the scope repository does, to avoid a composition cycle. */
const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
const REP_PATCH_TYPE_SLUG = "patch";

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
   * profiles — the same denominator the rep's own Desempenho uses, so the
   * roster and the drill-down agree.
   */
  async listRepsUnderZones(input: {
    verticalId: number;
    zoneIds: number[];
  }): Promise<TeamMemberRow[]> {
    if (input.zoneIds.length === 0) return [];

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
                 AND f.deactivated_at IS NULL)::int AS assigned_clinic_count
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      INNER JOIN user_territory_assignments uta ON uta.user_id = u.id
      INNER JOIN territories t ON t.id = uta.territory_id
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE u.deleted_at IS NULL
        AND t.vertical_id = ${input.verticalId}
        AND t.is_active = true
        AND tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND t.manager_territory_id IN (${sql.join(
          input.zoneIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.avatar_url, r.name
      ORDER BY name NULLS LAST, u.id
    `);
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
