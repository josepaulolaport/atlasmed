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
import { sql, eq, and, or, ilike, inArray, isNotNull, isNull, exists, type SQL } from "drizzle-orm";
import type { FacilityListSort } from "../../../facility/application/interfaces/facility.repository.interface";
import { buildFacilityListOrderBy } from "../../../facility/infrastructure/repositories/drizzle/drizzle-facility.repository";
import type { DashboardProfileFilter } from "../../application/dashboard-query";

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
 * CPF clinics whose document cannot be used, split by why.
 *
 * Two numbers rather than one because the fixes differ: `missing` needs
 * somebody to find out the CPF, `invalid` needs somebody to correct a number
 * already on file. A merged count would send a rep into the list to work out
 * which they were looking at.
 */
export type CpfIssueCounts = {
  /** `legal_document` is NULL or blank. */
  missing: number;
  /** Present, but fails the módulo-11 check. */
  invalid: number;
};

export const EMPTY_CPF_ISSUE_COUNTS: CpfIssueCounts = {
  missing: 0,
  invalid: 0,
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

/** An open rep assignment on this profile, held by one of `userIds`. */
function hasOpenAssignmentTo(userIds: number[]) {
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
          inArray(facilityVerticalRepAssignments.userId, userIds),
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
 * The zone holds at least one clinic the caller's filters let through.
 *
 * Without it the território map answered a different question from the numbers
 * printed under it: geometry came from the linha alone, so filtering Desempenho
 * to Rio de Janeiro moved "146 clínicas · 214 médicos · 14%" and left the map
 * showing Amazonas, Pará and Maranhão. One card, two scopes.
 *
 * Stated as "contains a clinic in scope" rather than as a translation of each
 * filter into geography, because that is the one form every filter shares — a
 * state, a município, a gestor, a rep and a unit type all narrow the clinic set,
 * and none of them has a boundary of its own to intersect. A zone that ends up
 * holding nothing simply is not drawn.
 */
function holdsAClinicInScope(filter: DashboardProfileFilter) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(
        and(
          ...profileScopeConditions(filter),
          sql`ST_Intersects(${territories.boundary}, ${facilities.location})`,
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
  if (filter.repUserIds !== null) {
    conditions.push(hasOpenAssignmentTo(filter.repUserIds));
  }
  if (filter.stateIds !== null) {
    conditions.push(inArray(facilities.stateId, filter.stateIds));
  }
  if (filter.municipalityIds !== null) {
    conditions.push(inArray(facilities.municipalityId, filter.municipalityIds));
  }
  if (filter.unitTypeIds !== null) {
    conditions.push(inArray(facilities.unitTypeId, filter.unitTypeIds));
  }

  return conditions;
}

/**
 * CPF clinics with an unusable document, in the given scope.
 *
 * Built from [profileScopeConditions] like every other metric, so the warning
 * answers the same question as the cards beside it. It arrived taking its own
 * `{verticalIds, facilityIds}` pair, which meant a rep who narrowed the screen
 * by state saw a warning counting the whole country.
 *
 * `COUNT(DISTINCT facilities.id)`, unlike the profile counts: a clinic in two
 * linhas has two profiles but only one CPF, so counting rows would report one
 * problem twice and send the rep to a list shorter than the number that opened
 * it.
 *
 * The two filters are mutually exclusive by construction — `invalid` requires a
 * non-blank document — so no clinic lands in both.
 *
 * Exported for query-shape tests; callers use the repository method.
 */
export function buildCpfIssueCountsQuery(filter: DashboardProfileFilter) {
  const blank = sql`(${facilities.legalDocument} is null or btrim(${facilities.legalDocument}) = '')`;

  return db
    .select({
      missing: sql<number>`COUNT(DISTINCT ${facilities.id}) FILTER (WHERE ${blank})::int`,
      invalid: sql<number>`COUNT(DISTINCT ${facilities.id}) FILTER (WHERE NOT ${blank} AND NOT is_valid_cpf(${facilities.legalDocument}))::int`,
    })
    .from(facilityVerticalProfiles)
    .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
    .where(
      and(
        ...profileScopeConditions(filter),
        eq(facilities.legalDocumentType, "CPF"),
      ),
    );
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

/**
 * One choice in a filter drawer, and — for the nested facets — what it belongs
 * to (spec 0014 §5).
 *
 * `parentIds` is what lets selection cascade rather than only options: picking
 * the *city* of Rio de Janeiro selects the state of Rio de Janeiro with it, and
 * deselecting that state drops every municipality inside it. Without the link
 * the client would have to infer parentage from the option lists, which it
 * cannot do — the lists it holds are already narrowed, so a municipality whose
 * state was filtered out would have no discoverable parent at all.
 *
 * A municipality has exactly one state. A rep may hold patches under two
 * managers (spec 0009), so `parentIds` is a list, and a rep is dropped only when
 * *none* of their managers is still selected.
 */
export type DashboardFilterOption = {
  id: number;
  label: string;
  parentIds?: number[];
};

export class DrizzleDashboardRepository {
  /**
   * The states that actually have clinics in this scope (spec 0014 §5).
   *
   * Not "the 27 states of Brazil": a manager whose zones are Paraná and Norte
   * has no business being offered Bahia, and an option that can only ever
   * return zero clinics is not a filter, it is a dead end the user has to
   * discover by tapping it.
   */
  async listStateOptions(
    filter: DashboardProfileFilter,
  ): Promise<DashboardFilterOption[]> {
    const rows = await db
      .selectDistinct({ id: states.id, label: states.name })
      .from(facilityVerticalProfiles)
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .innerJoin(states, eq(states.id, facilities.stateId))
      .where(and(...profileScopeConditions(filter)))
      .orderBy(states.name);

    return rows;
  }

  /**
   * Municipalities with clinics in scope, each carrying its state.
   *
   * The state comes from `facilities.state_id` rather than from the
   * municipality row, so the parent is the one the clinic is actually filtered
   * by — if those two ever disagreed, cascading on the other would deselect a
   * municipality that the state filter still matches.
   */
  async listMunicipalityOptions(
    filter: DashboardProfileFilter,
  ): Promise<DashboardFilterOption[]> {
    const rows = await db
      .selectDistinct({
        id: municipalities.id,
        label: municipalities.name,
        stateId: facilities.stateId,
      })
      .from(facilityVerticalProfiles)
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
      .where(and(...profileScopeConditions(filter)))
      .orderBy(municipalities.name);

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      parentIds: [row.stateId],
    }));
  }

  /**
   * Managers who own a zone holding clinics in this scope.
   *
   * Derived through `manager_zone_id` rather than from the user table, so the
   * list is the managers who actually have something here — the same
   * territory-derived definition the roster uses (spec 0009).
   */
  async listManagerOptions(
    filter: DashboardProfileFilter,
  ): Promise<DashboardFilterOption[]> {
    const scoped = db
      .select({ zoneId: facilityVerticalProfiles.managerZoneId })
      .from(facilityVerticalProfiles)
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .where(and(...profileScopeConditions(filter)));

    const rows = await db.execute(sql`
      SELECT DISTINCT u.id AS id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS label
        FROM ${userTerritoryAssignments} uta
        JOIN users u ON u.id = uta.user_id AND u.deleted_at IS NULL
        JOIN roles r ON r.id = u.role_id AND r.name = 'MANAGER'
       WHERE uta.territory_id IN (${scoped})
       ORDER BY label
    `);

    return (rows as unknown as Array<{ id: number | string; label: string }>).map((row) => ({
      id: Number(row.id),
      label: row.label,
    }));
  }

  /**
   * Reps holding an open assignment on a clinic in this scope, each carrying
   * the managers they report to.
   *
   * Parentage is territory-derived like everything else in spec 0009 — patch →
   * its manager zone → whoever holds that zone — never `users.manager_id`. A
   * rep with patches under two managers therefore has two parents, and stays
   * selected while either one is.
   */
  async listRepOptions(
    filter: DashboardProfileFilter,
  ): Promise<DashboardFilterOption[]> {
    const scoped = buildScopedProfilesQuery(filter);

    const rows = await db.execute(sql`
      SELECT DISTINCT
             u.id AS id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS label,
             -- A correlated subquery of INNER JOINs, not a LEFT JOIN chain.
             -- In a LEFT JOIN, a condition in the ON clause does not filter the
             -- row out — it only nulls the joined side — so a rep holding a
             -- territory that is *not* a patch would still have had that
             -- territory's parent counted as their manager. Here every
             -- condition genuinely excludes.
             COALESCE((
               SELECT ARRAY_AGG(DISTINCT mgr.id)
                 FROM user_territory_assignments patch_uta
                 JOIN territories patch
                   ON patch.id = patch_uta.territory_id AND patch.is_active
                 JOIN territory_types patch_tt
                   ON patch_tt.id = patch.territory_type_id AND patch_tt.slug = 'patch'
                 JOIN territories zone
                   ON zone.id = patch.manager_territory_id AND zone.is_active
                 JOIN territory_types zone_tt
                   ON zone_tt.id = zone.territory_type_id AND zone_tt.slug = 'manager_zone'
                 JOIN user_territory_assignments zone_uta ON zone_uta.territory_id = zone.id
                 JOIN users mgr ON mgr.id = zone_uta.user_id AND mgr.deleted_at IS NULL
                 JOIN roles mgr_role ON mgr_role.id = mgr.role_id AND mgr_role.name = 'MANAGER'
                WHERE patch_uta.user_id = u.id
                  -- Per linha, like findManagerZoneIds: a rep may work Ortopedia
                  -- here and something else elsewhere, and the other linha's
                  -- manager is not a parent in this one.
                  AND patch.vertical_id = ${filter.verticalId}
             ), ARRAY[]::bigint[]) AS parent_ids
        FROM ${facilityVerticalRepAssignments} a
        JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
       WHERE a.facility_vertical_profile_id IN (${scoped})
         AND a.ended_at IS NULL
       ORDER BY label
    `);

    return (
      rows as unknown as Array<{
        id: number | string;
        label: string;
        parent_ids: Array<number | string>;
      }>
    ).map((row) => ({
      id: Number(row.id),
      label: row.label,
      parentIds: (row.parent_ids ?? []).map(Number),
    }));
  }

  /** The scoped clinic set — the denominator every ratio below divides by. */
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
   *
   * One count per stage, not the three pre-grouped buckets this returned
   * before. Grouping in SQL cost two things: PURCHASE_WINDOW ("due to buy now")
   * and OUTSIDE_WINDOW ("recently served") were summed into one number even
   * though a rep acts on them differently, and INACTIVE was folded in with
   * NEVER_PURCHASED — so a clinic that bought for two years and then lapsed
   * counted as never having bought, and Cobertura read lower than reality.
   */
  async countPurchaseBuckets(
    filter: DashboardProfileFilter,
  ): Promise<PurchaseStatusBuckets> {
    const [row] = await db
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
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...profileScopeConditions(filter)));

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

  /** CPF clinics whose document is blank or fails the check digits. */
  async countCpfIssues(filter: DashboardProfileFilter): Promise<CpfIssueCounts> {
    const [row] = await buildCpfIssueCountsQuery(filter);

    return {
      missing: Number(row?.missing ?? 0),
      invalid: Number(row?.invalid ?? 0),
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
   * Clínicas atribuídas — scoped profiles that actually hold an open rep
   * assignment.
   *
   * The card counted the whole scope before, which is the denominator and not
   * the metric: an admin read "2374 atribuídas" beside "941 sem representante"
   * on the same screen, and 941 of those 2374 had no rep by the neighbouring
   * card's own definition. Sharing `hasAnyOpenAssignment` with
   * [countProfilesWithoutRep] is what makes the pair exhaustive — the two
   * counts sum to `countProfiles` for any filter, and a test says so.
   *
   * A rep sees no change: every clinic in their scope is in it *because* they
   * are assigned to it, so the extra condition matches everything.
   */
  async countProfilesWithRep(filter: DashboardProfileFilter): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(facilityVerticalProfiles)
      .innerJoin(
        facilities,
        eq(facilities.id, facilityVerticalProfiles.facilityId),
      )
      .where(and(...profileScopeConditions(filter), hasAnyOpenAssignment()));

    return Number(row?.n ?? 0);
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

    // A `Date` bound inside a raw `sql` template never reaches the column's
    // encoder — there is no column for the driver to infer from — and postgres-js
    // rejects it at Bind time with ERR_INVALID_ARG_TYPE. Mapping through the
    // column itself is what the builder path does, so the two agree on how a
    // `timestamp without time zone` holding UTC is written.
    const bound = (instant: Date) =>
      orders.orderedAt.mapToDriverValue(instant) as string;

    const counters = input.ranges.map(
      (range) =>
        sql`COUNT(*) FILTER (WHERE ${orders.orderedAt} >= ${bound(range.start)}::timestamp AND ${orders.orderedAt} < ${bound(range.end)}::timestamp)::int`,
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
   * **Averages the stored `share`; it does not recompute one.** That is the
   * whole point after spec 0013 §4.6. `share` is null unless the market is
   * actually known — either a competitor figure exists, or a rep has claimed
   * "nenhuma outra marca" — so a clinic with orders and no competitor data
   * contributes nothing. Dividing `ours_qty` by the total here instead would
   * call that clinic 100% and fold it into a manager's average: the plausible
   * wrong number the claim was introduced to prevent, arriving through the
   * aggregate rather than the clinic screen.
   *
   * `AVG` and `COUNT` both skip nulls, which is exactly spec 0014 §4's "counting
   * only clinics where it is calculated" — and why `COALESCE(share, 0)` must
   * never appear here: it would average "we know nothing" in as "we sell
   * nothing".
   *
   * One row per (profile, metric) since §4.6 — no month, no window, no summing.
   * The value is what is true now, and nothing reads it as a series.
   */
  async averageShareByDefinition(input: {
    filter: DashboardProfileFilter;
  }): Promise<DashboardPenetrationRow[]> {
    const scoped = buildScopedProfilesQuery(input.filter);

    const rows = (await db.execute(sql`
      SELECT d.id    AS definition_id,
             d.key   AS key,
             d.label AS label,
             AVG(s.share)        AS mean_share,
             COUNT(s.share)::int AS clinics_counted
      FROM ${productPotentialDefinitions} d
      LEFT JOIN facility_metric_snapshots s
        ON s.definition_id = d.id
       AND s.facility_vertical_profile_id IN (${scoped})
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
    /** Free text over name, neighbourhood and city — the list's own search. */
    search?: string;
    /**
     * Explorar's own sort keys, honoured by Explorar's own expression.
     *
     * Imported rather than reimplemented: "Nome Z–A" and "Status de compras"
     * have to mean the same thing in both lists, and the funnel-stage rank and
     * the nulls-last handling on last purchase are exactly the details a second
     * copy gets subtly wrong. `distance` is absent on purpose — this list has
     * no origin, and the sheet hides the option rather than offering a sort
     * that does nothing.
     */
    sort?: FacilityListSort;
    order?: "asc" | "desc";
    offset: number;
    limit: number;
  }): Promise<{ rows: DashboardClinicRow[]; total: number }> {
    const conditions = profileScopeConditions(input.filter);
    if (input.predicate) conditions.push(input.predicate);

    const search = input.search?.trim();
    if (search) {
      /**
       * Plain ILIKE over name, neighbourhood and city.
       *
       * Not `unaccent`: the extension is installed on no database here, and
       * adding one is a migration rather than a search feature. This matches
       * what the facility module's own SQL path does, so the two searches miss
       * on the same input rather than on different ones — Explorar reaches
       * accent-folded matching through Meilisearch, which this list has no
       * index for.
       */
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(facilities.displayName, pattern),
          ilike(facilities.neighborhood, pattern),
          ilike(municipalities.name, pattern),
        )!,
      );
    }

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
      .orderBy(
        ...buildFacilityListOrderBy({
          sort: input.sort,
          order: input.order,
          verticalIds: [input.filter.verticalId],
        }),
      )
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
    filter: DashboardProfileFilter;
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
          // Same predicate the denominator uses (`findManagerZoneIds`). Without
          // it the card can draw a retired zone the metrics already stopped
          // counting, and the map would disagree with every number beside it.
          eq(territories.isActive, true),
          holdsAClinicInScope(input.filter),
        ),
      )
      .orderBy(territories.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      boundary: r.boundary ? (JSON.parse(r.boundary) as unknown) : null,
    }));
  }

  async listVerticalTerritoryFeatures(input: {
    verticalId: number;
    filter: DashboardProfileFilter;
  }): Promise<DashboardTerritoryFeature[]> {
    const rows = await db
      .select({
        id: territories.id,
        name: territories.name,
        boundary: sql<string>`ST_AsGeoJSON(${territories.boundary})::text`,
      })
      .from(territories)
      .where(
        and(
          eq(territories.verticalId, input.verticalId),
          eq(territories.isActive, true),
          isNotNull(territories.boundary),
          holdsAClinicInScope(input.filter),
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
