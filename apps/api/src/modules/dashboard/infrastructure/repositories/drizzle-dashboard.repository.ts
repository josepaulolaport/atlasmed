import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalProfiles,
  facilityProfessionals,
  territories,
  userTerritoryAssignments,
} from "@atlasmed/database";
import { sql, eq, and, inArray } from "drizzle-orm";

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
    const where = input.facilityIds === null
      ? eq(facilityVerticalProfiles.verticalId, input.verticalId)
      : input.facilityIds.length === 0
        ? and(
            eq(facilityVerticalProfiles.verticalId, input.verticalId),
            sql`FALSE`,
          )
        : and(
            eq(facilityVerticalProfiles.verticalId, input.verticalId),
            inArray(facilityVerticalProfiles.facilityId, input.facilityIds),
          );

    const [row] = await db
      .select({
        active:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseStatus} IN ('HIGH_BUYER', 'REGULAR_BUYER'))::int`,
        inactive:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseStatus} = 'LOW_BUYER')::int`,
        neverBought:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseStatus} = 'NON_BUYER' OR ${facilityVerticalProfiles.purchaseStatus} IS NULL)::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(facilityVerticalProfiles)
      .where(where);

    return {
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      neverBought: Number(row?.neverBought ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async countDoctors(input: {
    verticalId: string;
    facilityIds: string[] | null;
  }): Promise<number> {
    const joinCondition = and(
      eq(facilityVerticalProfiles.facilityId, facilityProfessionals.facilityId),
      eq(facilityVerticalProfiles.verticalId, input.verticalId),
    );

    const where =
      input.facilityIds === null
        ? undefined
        : input.facilityIds.length === 0
          ? sql`FALSE`
          : inArray(facilityProfessionals.facilityId, input.facilityIds);

    const [row] = await db
      .select({
        n: sql<number>`COUNT(DISTINCT ${facilityProfessionals.professionalId})::int`,
      })
      .from(facilityProfessionals)
      .innerJoin(facilityVerticalProfiles, joinCondition)
      .where(where);

    return Number(row?.n ?? 0);
  }

  /** Territories assigned to the user that belong to the vertical. */
  async listAssignedTerritoryFeatures(input: {
    userId: string;
    verticalId: string;
  }): Promise<DashboardTerritoryFeature[]> {
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
          eq(territories.verticalId, input.verticalId),
        ),
      )
      .orderBy(territories.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }

  /** All territories with boundaries for a vertical (ADMIN overview). */
  async listVerticalTerritoryFeatures(
    verticalId: string,
  ): Promise<DashboardTerritoryFeature[]> {
    const rows = await db
      .select({
        id: territories.id,
        name: territories.name,
        boundary: sql<string>`ST_AsGeoJSON(${territories.boundary})::text`,
      })
      .from(territories)
      .where(
        and(
          eq(territories.verticalId, verticalId),
          sql`${territories.boundary} IS NOT NULL`,
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
