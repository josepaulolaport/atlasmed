import { db } from "../../../../infrastructure/database/db";
import {
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  personFacilities,
  facilities,
  municipalities,
  orders,
  productPotentialDefinitions,
  states,
  territories,
  userTerritoryAssignments,
} from "@atlasmed/database";
import type { MonthKey } from "@atlasmed/facility-insights";
import { sql, eq, and, inArray, isNotNull, isNull, exists, type SQL } from "drizzle-orm";
import type { DashboardProfileFilter } from "../../application/dashboard-query";

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

export type DashboardPenetrationRow = {
  definitionId: number;
  key: string;
  label: string;
  /** Mean share across clinics where it is calculated, 0–1. Null when none is. */
  meanShare: number | null;
  /** How many clinics contributed — the denominator of the mean, not of scope. */
  clinicsCounted: number;
};

export type DashboardClinicRow = {
  facilityId: number;
  facilityVerticalProfileId: number;
  name: string;
  city: string | null;
  state: string | null;
  purchaseFunnelStage: string;
  conformityStatus: string;
  repName: string | null;
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

/** An open rep assignment on this profile, held by `userId`. */
function hasOpenAssignmentTo(userId: number) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(facilityVerticalRepAssignments)
      .where(
        and(
          eq(
            facilityVerticalRepAssignments.facilityVerticalProfileId,
            facilityVerticalProfiles.id,
          ),
          eq(facilityVerticalRepAssignments.userId, userId),
          isNull(facilityVerticalRepAssignments.endedAt),
        ),
      ),
  );
}

/** Any open rep assignment on this profile, whoever holds it. */
function hasAnyOpenAssignment() {
  return exists(
    db
      .select({ one: sql`1` })
      .from(facilityVerticalRepAssignments)
      .where(
        and(
          eq(
            facilityVerticalRepAssignments.facilityVerticalProfileId,
            facilityVerticalProfiles.id,
          ),
          isNull(facilityVerticalRepAssignments.endedAt),
        ),
      ),
  );
}

/**
 * The one predicate every metric shares (spec 0014 §4: "Each metric is a
 * separate endpoint, taking the same scope + filter parameters").
 *
 * Exported so the metric queries and their per-clinic breakdowns (§4.1) cannot
 * drift: a card whose drill-down lists a different set of clinics than the
 * number it came from is worse than either alone.
 */
export function profileScopeConditions(filter: DashboardProfileFilter): SQL[] {
  const conditions: SQL[] = [
    eq(facilityVerticalProfiles.verticalId, filter.verticalId),
    eq(facilityVerticalProfiles.isActive, true),
    liveFacility(),
  ];

  if (filter.zoneIds !== null) {
    conditions.push(
      inArray(facilityVerticalProfiles.managerZoneId, filter.zoneIds),
    );
  }
  if (filter.repUserId !== null) {
    conditions.push(hasOpenAssignmentTo(filter.repUserId));
  }
  if (filter.stateId !== null) {
    conditions.push(eq(facilities.stateId, filter.stateId));
  }
  if (filter.municipalityId !== null) {
    conditions.push(eq(facilities.municipalityId, filter.municipalityId));
  }
  if (filter.unitTypeId !== null) {
    conditions.push(eq(facilities.unitTypeId, filter.unitTypeId));
  }

  return conditions;
}

/**
 * The profile ids in scope, as a subquery.
 *
 * Exported for query-shape tests: API tests are unit-only (no database is
 * seeded), so invariants like "deactivated facilities appear in no count" are
 * asserted against the emitted SQL rather than against rows.
 */
export function buildScopedProfilesQuery(filter: DashboardProfileFilter) {
  return db
    .select({ id: facilityVerticalProfiles.id })
    .from(facilityVerticalProfiles)
    .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
    .where(and(...profileScopeConditions(filter)));
}

export class DrizzleDashboardRepository {
  /** Clínicas atribuídas — the denominator every ratio below divides by. */
  async countProfiles(filter: DashboardProfileFilter): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...profileScopeConditions(filter)));

    return Number(row?.n ?? 0);
  }

  /**
   * Purchase buckets — the donut, and the numerator of Cobertura.
   *
   * Buckets come from `purchase_funnel_stage`; `purchase_status` was dropped as
   * dead in spec 0010 §5.1.
   */
  async countPurchaseBuckets(
    filter: DashboardProfileFilter,
  ): Promise<PurchaseStatusBuckets> {
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
      .where(and(...profileScopeConditions(filter)));

    return {
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      neverBought: Number(row?.neverBought ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  /** Taxa de cadastro completo — `conformity_status = REGISTERED` over scope. */
  async countRegisteredProfiles(
    filter: DashboardProfileFilter,
  ): Promise<{ registered: number; total: number }> {
    const [row] = await db
      .select({
        registered:
          sql<number>`COUNT(*) FILTER (WHERE ${facilityVerticalProfiles.conformityStatus} = 'REGISTERED')::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...profileScopeConditions(filter)));

    return {
      registered: Number(row?.registered ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  /**
   * Clínicas não atribuídas (spec 0014 §4, manager only).
   *
   * "Unassigned" here means the `no_consultant` case of spec 0009 R4: a profile
   * inside the scope with no open rep assignment. The other two reasons that
   * roster carries — `ambiguous_zone` and `no_zone` — describe clinics with *no*
   * manager zone, so they are outside a manager's denominator by definition and
   * cannot appear in this count. Same rule, arrived at from the other side.
   */
  async countProfilesWithoutRep(
    filter: DashboardProfileFilter,
  ): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(
        and(...profileScopeConditions(filter), sql`NOT ${hasAnyOpenAssignment()}`),
      );

    return Number(row?.n ?? 0);
  }

  /**
   * Pedidos — a count of orders whose profile is in scope, in each window.
   *
   * Eligibility follows ADR 0003 (`APPROVED`/`INVOICED`, `SALE`/`CONSIGNMENT`),
   * the same rule the funnel and the market metric use. Counting every row
   * instead would count `DRAFT` and `REJECTED` orders as commercial activity,
   * which is the one thing this number is read as meaning.
   */
  async countOrders(input: {
    filter: DashboardProfileFilter;
    ranges: Array<{ key: string; start: Date; end: Date }>;
  }): Promise<Record<string, number>> {
    if (input.ranges.length === 0) return {};

    const scoped = buildScopedProfilesQuery(input.filter);

    const counters = input.ranges.map(
      (range) =>
        sql`COUNT(*) FILTER (WHERE ${orders.orderedAt} >= ${range.start} AND ${orders.orderedAt} < ${range.end})::int`,
    );

    const rows = (await db.execute(sql`
      SELECT ${sql.join(
        counters.map((counter, index) => sql`${counter} AS ${sql.identifier(`c${index}`)}`),
        sql`, `,
      )}
      FROM ${orders}
      WHERE ${orders.facilityVerticalProfileId} IN (${scoped})
        AND ${orders.status} IN ('APPROVED', 'INVOICED')
        AND ${orders.type} IN ('SALE', 'CONSIGNMENT')
    `)) as Array<Record<string, number | string>>;

    const row = rows[0];
    const result: Record<string, number> = {};
    input.ranges.forEach((range, index) => {
      result[range.key] = Number(row?.[`c${index}`] ?? 0);
    });
    return result;
  }

  /**
   * Penetração média — the mean of each clinic's share, per metric.
   *
   * **Per metric, not one blended number.** A vertical may define several
   * metrics (`ampolas_mes`, `prp`), and a product carries one `metric_units`
   * value per metric, so summing two definitions would add ampoules to
   * something that is not ampoules. One row per definition is the only
   * arithmetic that means anything.
   *
   * `AVG ... FILTER (WHERE total > 0)` is spec 0014 §4's "counting only clinics
   * where it is calculated": a clinic with no data must not drag the average
   * toward zero, because no-information and no-sales are different facts
   * (spec 0013 §4.3).
   *
   * Reads `facility_metric_snapshots`, which is what makes this aggregatable at
   * all — before spec 0013 the share was computed per request and could not be
   * rolled up. A profile with no snapshot rows in the window simply does not
   * appear, and is therefore excluded from the mean rather than counted as 0.
   */
  async averageShareByDefinition(input: {
    filter: DashboardProfileFilter;
    months: MonthKey[];
  }): Promise<DashboardPenetrationRow[]> {
    if (input.months.length === 0) return [];

    const scoped = buildScopedProfilesQuery(input.filter);

    const rows = (await db.execute(sql`
      WITH per_profile AS (
        SELECT s.definition_id,
               SUM(s.ours_qty)   AS ours,
               SUM(s.theirs_qty) AS theirs
        FROM facility_metric_snapshots s
        WHERE s.facility_vertical_profile_id IN (${scoped})
          AND s.month IN (${sql.join(
            input.months.map((month) => sql`${month}::date`),
            sql`, `,
          )})
        GROUP BY s.definition_id, s.facility_vertical_profile_id
      )
      SELECT d.id            AS definition_id,
             d.key           AS key,
             d.label         AS label,
             AVG(p.ours / NULLIF(p.ours + p.theirs, 0))
               FILTER (WHERE p.ours + p.theirs > 0)      AS mean_share,
             COUNT(*) FILTER (WHERE p.ours + p.theirs > 0)::int AS clinics_counted
      FROM ${productPotentialDefinitions} d
      LEFT JOIN per_profile p ON p.definition_id = d.id
      WHERE d.vertical_id = ${input.filter.verticalId}
        AND d.deleted_at IS NULL
      GROUP BY d.id, d.key, d.label
      ORDER BY d.label
    `)) as Array<{
      definition_id: number | string;
      key: string;
      label: string;
      mean_share: string | number | null;
      clinics_counted: number | string;
    }>;

    return rows.map((row) => ({
      definitionId: Number(row.definition_id),
      key: row.key,
      label: row.label,
      meanShare: row.mean_share === null ? null : Number(row.mean_share),
      clinicsCounted: Number(row.clinics_counted),
    }));
  }

  /**
   * The per-clinic breakdown behind every metric card (spec 0014 §4.1).
   *
   * `predicate` narrows the shared scope to the metric's own subset — the
   * clinics in a bucket, the ones without a rep — so a card and its drill-down
   * are the same query with one extra condition, and cannot disagree.
   */
  async listScopedClinics(input: {
    filter: DashboardProfileFilter;
    predicate?: SQL;
    offset: number;
    limit: number;
  }): Promise<{ rows: DashboardClinicRow[]; total: number }> {
    const conditions = profileScopeConditions(input.filter);
    if (input.predicate) conditions.push(input.predicate);

    const rows = await db
      .select({
        facilityId: facilities.id,
        facilityVerticalProfileId: facilityVerticalProfiles.id,
        name: facilities.displayName,
        city: municipalities.name,
        state: states.abbreviation,
        purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
        conformityStatus: facilityVerticalProfiles.conformityStatus,
        repName: sql<
          string | null
        >`(SELECT NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '')
             FROM facility_vertical_rep_assignments a
             JOIN users u ON u.id = a.user_id
            WHERE a.facility_vertical_profile_id = ${facilityVerticalProfiles.id}
              AND a.ended_at IS NULL
            LIMIT 1)`,
        total: sql<number>`COUNT(*) OVER ()::int`,
      })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .innerJoin(
        municipalities,
        eq(municipalities.id, facilities.municipalityId),
      )
      .innerJoin(states, eq(states.id, facilities.stateId))
      .where(and(...conditions))
      .orderBy(facilities.displayName, facilities.id)
      .offset(input.offset)
      .limit(input.limit);

    return {
      rows: rows.map((row) => ({
        facilityId: row.facilityId,
        facilityVerticalProfileId: row.facilityVerticalProfileId,
        name: row.name,
        city: row.city,
        state: row.state,
        purchaseFunnelStage: row.purchaseFunnelStage,
        conformityStatus: row.conformityStatus,
        repName: row.repName,
      })),
      total: Number(rows[0]?.total ?? 0),
    };
  }

  /** Distinct people attached to the clinics in scope — the territory card. */
  async countDoctors(filter: DashboardProfileFilter): Promise<number> {
    const scoped = db
      .select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...profileScopeConditions(filter)));

    const [row] = await db
      .select({
        n: sql<number>`COUNT(DISTINCT ${personFacilities.personId})::int`,
      })
      .from(personFacilities)
      .where(
        and(
          isNull(personFacilities.endedAt),
          inArray(personFacilities.facilityId, scoped),
        ),
      );

    return Number(row?.n ?? 0);
  }

  async listAssignedTerritoryFeatures(input: {
    userId: number;
    verticalId: number;
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

  async listVerticalTerritoryFeatures(
    verticalId: number,
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
