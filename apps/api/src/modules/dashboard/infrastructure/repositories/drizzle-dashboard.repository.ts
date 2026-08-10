import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalProfiles,
  personFacilities,
  facilities,
  territories,
  userTerritoryAssignments,
} from "@atlasmed/database";
import { sql, eq, and, inArray, isNotNull, isNull } from "drizzle-orm";

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

/**
 * Facilities are soft-deleted through `facilities.deactivated_at`. Spec 0014
 * §4/§7.5: deactivated facilities are excluded from every dashboard count, so
 * they never inflate a denominator (and therefore never deflate `coveragePercent`).
 *
 * This is a distinct concern from `facility_vertical_profiles.is_active`, which
 * says whether a *live* facility participates in one vertical. Both predicates
 * apply; neither replaces the other.
 */
function liveFacility() {
  return isNull(facilities.deactivatedAt);
}

/**
 * Purchase buckets for profiled facilities in the given verticals,
 * optionally restricted to a facility id set (non-global scopes).
 * Exported for query-shape tests; callers use the repository method.
 */
export function buildPurchaseBucketsQuery(input: {
  verticalIds: number[];
  facilityIds: number[] | null;
}) {
  const conditions = [
    inArray(facilityVerticalProfiles.verticalId, input.verticalIds),
    eq(facilityVerticalProfiles.isActive, true),
    liveFacility(),
  ];
  if (input.facilityIds !== null) {
    conditions.push(
      inArray(facilityVerticalProfiles.facilityId, input.facilityIds),
    );
  }

  return db
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
    .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
    .where(and(...conditions));
}

/**
 * Distinct people attached to live, profiled facilities in the given verticals.
 * Exported for query-shape tests; callers use the repository method.
 */
export function buildDoctorCountQuery(input: {
  verticalIds: number[];
  facilityIds: number[] | null;
}) {
  const joinCondition = and(
    eq(facilityVerticalProfiles.facilityId, personFacilities.facilityId),
    inArray(facilityVerticalProfiles.verticalId, input.verticalIds),
    eq(facilityVerticalProfiles.isActive, true),
    isNull(personFacilities.endedAt),
  );

  const conditions = [liveFacility()];
  if (input.facilityIds !== null) {
    conditions.push(inArray(personFacilities.facilityId, input.facilityIds));
  }

  return db
    .select({
      n: sql<number>`COUNT(DISTINCT ${personFacilities.personId})::int`,
    })
    .from(personFacilities)
    .innerJoin(facilityVerticalProfiles, joinCondition)
    .innerJoin(facilities, eq(facilities.id, personFacilities.facilityId))
    .where(and(...conditions));
}

export class DrizzleDashboardRepository {
  /**
   * Purchase buckets for profiled facilities in the given verticals,
   * optionally restricted to a facility id set (non-global scopes).
   */
  async countPurchaseBuckets(input: {
    verticalIds: number[];
    facilityIds: number[] | null;
  }): Promise<PurchaseStatusBuckets> {
    if (input.verticalIds.length === 0) {
      return { active: 0, inactive: 0, neverBought: 0, total: 0 };
    }
    if (input.facilityIds !== null && input.facilityIds.length === 0) {
      return { active: 0, inactive: 0, neverBought: 0, total: 0 };
    }

    const [row] = await buildPurchaseBucketsQuery(input);

    return {
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      neverBought: Number(row?.neverBought ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async countDoctors(input: {
    verticalIds: number[];
    facilityIds: number[] | null;
  }): Promise<number> {
    if (input.verticalIds.length === 0) return 0;
    if (input.facilityIds !== null && input.facilityIds.length === 0) {
      return 0;
    }

    const [row] = await buildDoctorCountQuery(input);

    return Number(row?.n ?? 0);
  }

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
