import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalProfiles,
  personFacilities,
  facilities,
  territories,
  userTerritoryAssignments,
} from "@atlasmed/database";
import { sql, eq, and, inArray, isNotNull, isNull } from "drizzle-orm";

/**
 * One count per `purchase_funnel_stage`, plus `UNKNOWN` for profiles the funnel
 * has not calculated yet.
 *
 * The endpoint used to return three pre-grouped buckets (`active` /`inactive` /
 * `neverBought`), which meant the grouping lived in SQL and no client could
 * regroup or draw a finer breakdown — the counts for PURCHASE_WINDOW ("due to
 * buy now") and OUTSIDE_WINDOW ("recently served") never left the server, even
 * though they are the two states a rep acts on differently. Grouping is a
 * presentation choice and now belongs to the client.
 */
export type PurchaseFunnelStageCounts = {
  NEVER_PURCHASED: number;
  OUTSIDE_WINDOW: number;
  PURCHASE_WINDOW: number;
  CHURN: number;
  INACTIVE: number;
  /** Profile exists but `purchase_funnel_stage` is null. */
  UNKNOWN: number;
};

export type PurchaseStatusBuckets = {
  stages: PurchaseFunnelStageCounts;
  total: number;
};

export const EMPTY_PURCHASE_FUNNEL_STAGE_COUNTS: PurchaseFunnelStageCounts = {
  NEVER_PURCHASED: 0,
  OUTSIDE_WINDOW: 0,
  PURCHASE_WINDOW: 0,
  CHURN: 0,
  INACTIVE: 0,
  UNKNOWN: 0,
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
      NEVER_PURCHASED:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'NEVER_PURCHASED')::int`,
      OUTSIDE_WINDOW:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'OUTSIDE_WINDOW')::int`,
      PURCHASE_WINDOW:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'PURCHASE_WINDOW')::int`,
      CHURN:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'CHURN')::int`,
      INACTIVE:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} = 'INACTIVE')::int`,
      UNKNOWN:
        sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.purchaseFunnelStage} IS NULL)::int`,
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
    const empty = {
      stages: { ...EMPTY_PURCHASE_FUNNEL_STAGE_COUNTS },
      total: 0,
    };
    if (input.verticalIds.length === 0) return empty;
    if (input.facilityIds !== null && input.facilityIds.length === 0) {
      return empty;
    }

    const [row] = await buildPurchaseBucketsQuery(input);

    return {
      stages: {
        NEVER_PURCHASED: Number(row?.NEVER_PURCHASED ?? 0),
        OUTSIDE_WINDOW: Number(row?.OUTSIDE_WINDOW ?? 0),
        PURCHASE_WINDOW: Number(row?.PURCHASE_WINDOW ?? 0),
        CHURN: Number(row?.CHURN ?? 0),
        INACTIVE: Number(row?.INACTIVE ?? 0),
        UNKNOWN: Number(row?.UNKNOWN ?? 0),
      },
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
