import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalProfiles,
  facilities,
  territories,
  userTerritoryAssignments,
} from "@atlasmed/database";
import { sql, eq, and, inArray, isNotNull } from "drizzle-orm";

export type PurchaseStatusBuckets = {
  active: number;
  inactive: number;
  neverBought: number;
  total: number;
};

export type DashboardTerritoryFeature = {
  id: number;
  name: string;
  boundary: unknown;
};

export class DrizzleDashboardRepository {
  /**
   * Purchase buckets for profiled facilities in the given verticals,
   * optionally restricted to a facility id set (non-global scopes).
   *
   * active   = PURCHASE_WINDOW
   * inactive = OUTSIDE_WINDOW + CHURN
   * neverBought = NEVER_PURCHASED + INACTIVE (+ null)
   */
  async countPurchaseBuckets(input: {
    verticalIds: number[];
    facilityIds: number[] | null;
  }): Promise<PurchaseStatusBuckets> {
    if (input.verticalIds.length === 0) {
      return { active: 0, inactive: 0, neverBought: 0, total: 0 };
    }
    // Empty facilityIds → no facilities match → all buckets are zero.
    if (input.facilityIds !== null && input.facilityIds.length === 0) {
      return { active: 0, inactive: 0, neverBought: 0, total: 0 };
    }

    const conditions = [
      inArray(facilityVerticalProfiles.verticalId, input.verticalIds),
      eq(facilityVerticalProfiles.isActive, true),
    ];
    if (input.facilityIds !== null) {
      conditions.push(
        inArray(facilityVerticalProfiles.facilityId, input.facilityIds),
      );
    }

    const [row] = await db
      .select({
        active:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'PURCHASE_WINDOW')::int`,
        inactive:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} IN ('OUTSIDE_WINDOW', 'CHURN'))::int`,
        neverBought:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} IN ('NEVER_PURCHASED', 'INACTIVE') OR ${facilityVerticalProfiles.purchaseFunnelStage} IS NULL)::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...conditions));

    return {
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      neverBought: Number(row?.neverBought ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  /** TODO(ADR-0004): count distinct persons via person_facilities after schema lands. */
  async countDoctors(_input: {
    verticalIds: number[];
    facilityIds: number[] | null;
  }): Promise<number> {
    return 0;
  }

  /** Territories assigned to the user that belong to any of the verticals. */
  async listAssignedTerritoryFeatures(input: {
    userId: number;
    verticalIds: number[];
  }): Promise<DashboardTerritoryFeature[]> {
    if (input.verticalIds.length === 0) return [];

    const rows = await db
      .select({
        id: territories.id,
        name: territories.name,
        boundary: sql<string | null>`CASE WHEN ${territories.boundary} IS NULL THEN NULL ELSE ST_AsGeoJSON(${territories.boundary})::text END`,
      })
      .from(userTerritoryAssignments)
      .innerJoin(
        territories,
        eq(territories.id, userTerritoryAssignments.territoryId),
      )
      .where(
        and(
          eq(userTerritoryAssignments.userId, input.userId),
          inArray(territories.verticalId, input.verticalIds),
        ),
      )
      .orderBy(territories.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }

  /** All territories with boundaries for verticals (ADMIN overview). */
  async listVerticalTerritoryFeatures(
    verticalIds: number[],
  ): Promise<DashboardTerritoryFeature[]> {
    if (verticalIds.length === 0) return [];

    const rows = await db
      .select({
        id: territories.id,
        name: territories.name,
        boundary: sql<string>`ST_AsGeoJSON(${territories.boundary})::text`,
      })
      .from(territories)
      .where(
        and(
          inArray(territories.verticalId, verticalIds),
          isNotNull(territories.boundary),
        ),
      )
      .orderBy(territories.name)
      .limit(200);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }
}
