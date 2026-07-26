import { db } from "../../../../infrastructure/database/db";
import { sql } from "drizzle-orm";

export type PurchaseStatusBuckets = {
  active: number;
  inactive: number;
  neverBought: number;
  total: number;
};

export type DashboardTerritoryFeature = {
  id: string;
  name: string;
  boundary: unknown;
};

export class DrizzleDashboardRepository {
  /**
   * Purchase buckets for profiled facilities in one vertical, optionally
   * restricted to a facility id set (non-global scopes).
   *
   * active = HIGH_BUYER + REGULAR_BUYER
   * inactive = LOW_BUYER
   * neverBought = NON_BUYER (+ null treated as NON_BUYER)
   */
  async countPurchaseBuckets(input: {
    verticalId: string;
    facilityIds: string[] | null;
  }): Promise<PurchaseStatusBuckets> {
    const facilityFilter =
      input.facilityIds === null
        ? sql`TRUE`
        : input.facilityIds.length === 0
          ? sql`FALSE`
          : sql`fvp.facility_id IN (${sql.join(
              input.facilityIds.map((id) => sql`${id}`),
              sql`, `,
            )})`;

    const rows = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE fvp.purchase_status IN ('HIGH_BUYER', 'REGULAR_BUYER')
        )::int AS active,
        COUNT(*) FILTER (
          WHERE fvp.purchase_status = 'LOW_BUYER'
        )::int AS inactive,
        COUNT(*) FILTER (
          WHERE fvp.purchase_status = 'NON_BUYER'
             OR fvp.purchase_status IS NULL
        )::int AS never_bought,
        COUNT(*)::int AS total
      FROM facility_vertical_profiles fvp
      WHERE fvp.vertical_id = ${input.verticalId}
        AND ${facilityFilter}
    `)) as unknown as Array<{
      active: number;
      inactive: number;
      never_bought: number;
      total: number;
    }>;

    const row = Array.isArray(rows) ? rows[0] : undefined;
    return {
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      neverBought: Number(row?.never_bought ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async countDoctors(input: {
    verticalId: string;
    facilityIds: string[] | null;
  }): Promise<number> {
    const facilityFilter =
      input.facilityIds === null
        ? sql`TRUE`
        : input.facilityIds.length === 0
          ? sql`FALSE`
          : sql`fp.facility_id IN (${sql.join(
              input.facilityIds.map((id) => sql`${id}`),
              sql`, `,
            )})`;

    const rows = (await db.execute(sql`
      SELECT COUNT(DISTINCT fp.professional_id)::int AS n
      FROM facility_professionals fp
      INNER JOIN facility_vertical_profiles fvp
        ON fvp.facility_id = fp.facility_id
       AND fvp.vertical_id = ${input.verticalId}
      WHERE ${facilityFilter}
    `)) as unknown as Array<{ n: number }>;

    const row = Array.isArray(rows) ? rows[0] : undefined;
    return Number(row?.n ?? 0);
  }

  /** Territories assigned to the user that belong to the vertical. */
  async listAssignedTerritoryFeatures(input: {
    userId: string;
    verticalId: string;
  }): Promise<DashboardTerritoryFeature[]> {
    const rows = (await db.execute(sql`
      SELECT
        t.id,
        t.name,
        CASE
          WHEN t.boundary IS NULL THEN NULL
          ELSE ST_AsGeoJSON(t.boundary)::text
        END AS boundary
      FROM user_territory_assignments uta
      INNER JOIN territories t ON t.id = uta.territory_id
      WHERE uta.user_id = ${input.userId}
        AND t.vertical_id = ${input.verticalId}
      ORDER BY t.name
    `)) as unknown as Array<{
      id: string;
      name: string;
      boundary: string | null;
    }>;

    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }

  /** All territories with boundaries for a vertical (ADMIN overview). */
  async listVerticalTerritoryFeatures(
    verticalId: string,
  ): Promise<DashboardTerritoryFeature[]> {
    const rows = (await db.execute(sql`
      SELECT
        t.id,
        t.name,
        ST_AsGeoJSON(t.boundary)::text AS boundary
      FROM territories t
      WHERE t.vertical_id = ${verticalId}
        AND t.boundary IS NOT NULL
      ORDER BY t.name
      LIMIT 200
    `)) as unknown as Array<{
      id: string;
      name: string;
      boundary: string | null;
    }>;

    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }
}
