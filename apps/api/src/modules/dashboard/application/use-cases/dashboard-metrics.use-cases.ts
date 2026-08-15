import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import {
  APPLICATION_TIMEZONE,
  monthBounds,
  monthKeyAt,
} from "@atlasmed/facility-insights";
import { sql } from "drizzle-orm";
import { ForbiddenError } from "../../../../shared/errors";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import {
  EMPTY_CPF_ISSUE_COUNTS,
  EMPTY_PURCHASE_FUNNEL_STAGE_COUNTS,
} from "../../infrastructure/repositories/drizzle-dashboard.repository";
import type {
  CpfIssueCounts,
  DashboardClinicRow,
  DashboardFilterOption,
  DashboardPenetrationRow,
  DrizzleDashboardRepository,
  PurchaseStatusBuckets,
  DashboardTerritoryFeature,
} from "../../infrastructure/repositories/drizzle-dashboard.repository";
import {
  buildProfileFilter,
  resolveDenominator,
  resolveSingleVerticalId,
  resolveSubject,
  type DashboardDenominator,
  type DashboardDirectoryPort,
  type DashboardFacet,
  type DashboardFilters,
  type DashboardProfileFilter,
  type DashboardSubject,
} from "../dashboard-query";

export interface DashboardMetricRequest {
  viewerId: number;
  viewerRole: string;
  scope: ScopeContext;
  verticalId?: number | null;
  /** Spec 0014 §2: whose desempenho — omitted means the viewer's own. */
  subjectUserId?: number | null;
  /**
   * ADMIN only: the manager whose team the subject was reached through, so a
   * drill-down keeps the population the roster row showed. Ignored for a
   * MANAGER viewer, whose constraint is themselves and is derived rather than
   * accepted — see `resolveDenominator`.
   */
  withinManagerId?: number | null;
  filters: DashboardFilters;
}

export interface DashboardMetricContext {
  verticalId: number;
  subject: DashboardSubject;
  /** Null when the request resolves to "nothing matches". */
  filter: DashboardProfileFilter | null;
}

interface Dependencies {
  repository: DrizzleDashboardRepository;
  directory: DashboardDirectoryPort;
}

/**
 * Everything every metric endpoint does before it differs: pin the vertical,
 * decide whose numbers these are, and collapse role + filters into one
 * predicate.
 *
 * Shared as a base class rather than a helper each use case remembers to call —
 * a metric that forgot the scope step would silently answer for the whole
 * country, which is the defect spec 0014 exists to close.
 */
abstract class DashboardMetricUseCase {
  constructor(protected readonly deps: Dependencies) {}

  /**
   * Who these numbers are about, before any filter is applied.
   *
   * Split out from `resolve` because the filter-options endpoint needs the same
   * subject five times over, once per facet, and re-deriving it each time meant
   * five `findUser` lookups and five zone lookups for one request.
   */
  protected async resolveSubjectScope(
    request: DashboardMetricRequest,
  ): Promise<{
    verticalId: number;
    subject: DashboardSubject;
    denominator: DashboardDenominator;
  }> {
    const accessibleVerticalIds = resolveVerticalIds({
      role: request.viewerRole,
      assignedVerticalIds: request.scope.assignedVerticalIds ?? [],
      queryVerticalId: request.verticalId ?? null,
    });
    const verticalId = resolveSingleVerticalId({
      requestedVerticalId: request.verticalId ?? null,
      accessibleVerticalIds,
    });

    const viewer: DashboardSubject = {
      userId: request.viewerId,
      roleName: request.viewerRole,
    };
    const subject = await resolveSubject({
      viewer,
      subjectUserId: request.subjectUserId ?? null,
      managedUserIds: request.scope.managedUserIds ?? [],
      directory: this.deps.directory,
    });

    const denominator = await resolveDenominator({
      subject,
      verticalId,
      directory: this.deps.directory,
      viewer,
      withinManagerId: request.withinManagerId ?? null,
    });

    return { verticalId, subject, denominator };
  }

  protected async resolve(
    request: DashboardMetricRequest,
  ): Promise<DashboardMetricContext> {
    const { verticalId, subject, denominator } =
      await this.resolveSubjectScope(request);

    const resolved = await buildProfileFilter({
      verticalId,
      denominator,
      filters: request.filters,
      directory: this.deps.directory,
    });

    return {
      verticalId,
      subject,
      filter: resolved.empty ? null : resolved.filter,
    };
  }
}

/**
 * Clínicas atribuídas — profiles in scope that hold an open rep assignment.
 *
 * Not the whole scope, which is what this counted and what the label denied: an
 * admin saw "2374 atribuídas" next to "941 sem representante", two cards
 * describing the same clinics and disagreeing about them. Counting the
 * assignment makes the pair exhaustive — atribuídas + não atribuídas is the
 * denominator, for every filter.
 */
export class GetAssignedClinicsMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    value: number;
  }> {
    const context = await this.resolve(request);
    if (!context.filter) return { verticalId: context.verticalId, value: 0 };
    return {
      verticalId: context.verticalId,
      value: await this.deps.repository.countProfilesWithRep(context.filter),
    };
  }
}

/**
 * Cobertura — clinics that have **ever bought**, over the denominator.
 *
 * Everything that is not NEVER_PURCHASED, and not a profile the funnel has yet
 * to calculate, over the denominator. Stated that way rather than as
 * `active + inactive` over the old three buckets, which silently excluded the
 * INACTIVE stage — a clinic that bought for two years and then lapsed counted
 * as never having bought, and coverage read lower than reality.
 *
 * Percent is null rather than 0 when the denominator is empty: a rep with no
 * clinics has no coverage figure, and 0% would read as a failure rather than an
 * absence.
 */
export class GetCoverageMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    buckets: PurchaseStatusBuckets;
    covered: number;
    denominator: number;
    percent: number | null;
  }> {
    const context = await this.resolve(request);
    const buckets: PurchaseStatusBuckets = context.filter
      ? await this.deps.repository.countPurchaseBuckets(context.filter)
      : { stages: { ...EMPTY_PURCHASE_FUNNEL_STAGE_COUNTS }, total: 0 };

    const covered =
      buckets.total - buckets.stages.NEVER_PURCHASED - buckets.stages.UNKNOWN;
    return {
      verticalId: context.verticalId,
      buckets,
      covered,
      denominator: buckets.total,
      percent: buckets.total > 0 ? covered / buckets.total : null,
    };
  }
}

/** Distribuição por bucket — the donut, retained from the previous screen. */
export class GetPurchaseBucketsMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    buckets: PurchaseStatusBuckets;
  }> {
    const context = await this.resolve(request);
    return {
      verticalId: context.verticalId,
      buckets: context.filter
        ? await this.deps.repository.countPurchaseBuckets(context.filter)
        : { stages: { ...EMPTY_PURCHASE_FUNNEL_STAGE_COUNTS }, total: 0 },
    };
  }
}

/**
 * CPF clinics whose document is unusable — the warning above the donut.
 *
 * A metric like any other rather than a field on a composite payload, so it is
 * scoped by the same filter as the cards it sits with and fails on its own: a
 * warning that cannot be counted should not blank the screen behind it.
 */
export class GetCpfIssuesMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    issues: CpfIssueCounts;
  }> {
    const context = await this.resolve(request);
    return {
      verticalId: context.verticalId,
      issues: context.filter
        ? await this.deps.repository.countCpfIssues(context.filter)
        : { ...EMPTY_CPF_ISSUE_COUNTS },
    };
  }
}

/** Taxa de cadastro completo — `conformity_status = REGISTERED` over scope. */
export class GetCadastroCompletionMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    registered: number;
    denominator: number;
    percent: number | null;
  }> {
    const context = await this.resolve(request);
    const counts = context.filter
      ? await this.deps.repository.countRegisteredProfiles(context.filter)
      : { registered: 0, total: 0 };

    return {
      verticalId: context.verticalId,
      registered: counts.registered,
      denominator: counts.total,
      percent: counts.total > 0 ? counts.registered / counts.total : null,
    };
  }
}

/**
 * Pedidos — order counts for the trailing week and the current month.
 *
 * The month is a calendar month in `America/São_Paulo`, matching how every
 * other figure in the product is bucketed (spec 0013 §4.3). The week is the
 * trailing seven days rather than a calendar week, because there is no
 * established week-start convention here to inherit and inventing one would
 * make Monday's number drop to near zero for reasons nobody asked about.
 */
export class GetOrdersMetricUseCase extends DashboardMetricUseCase {
  async execute(
    request: DashboardMetricRequest & { now?: Date },
  ): Promise<{ verticalId: number; week: number; month: number }> {
    const context = await this.resolve(request);
    if (!context.filter) {
      return { verticalId: context.verticalId, week: 0, month: 0 };
    }

    const now = request.now ?? new Date();
    const month = monthBounds(monthKeyAt(now, APPLICATION_TIMEZONE));
    const counts = await this.deps.repository.countOrders({
      filter: context.filter,
      ranges: [
        {
          key: "week",
          start: new Date(now.getTime() - 7 * 86_400_000),
          end: now,
        },
        { key: "month", start: month.start, end: month.end },
      ],
    });

    return {
      verticalId: context.verticalId,
      week: counts.week ?? 0,
      month: counts.month ?? 0,
    };
  }
}

/**
 * Penetração média — the mean of each clinic's share, one row per metric.
 *
 * `denominator` is the clinics in scope; `clinicsCounted` is how many of them
 * had a calculable share. The gap between the two is the point: a mean over 3
 * of 200 clinics is a real number about very little, and hiding that behind a
 * single percentage is how a dashboard lies without ever being wrong.
 *
 * Since spec 0013 §4.6 the snapshot holds one row per (clinic, metric) rather
 * than one per month, so there is no window to choose here and no `now` to
 * inject: the value is what is true at the clinic today. The 90-day rolling
 * window still exists, but it lives inside the recompute that writes the row —
 * which is where it belongs, since a reader cannot derive a day window from
 * month facts anyway.
 */
export class GetPenetrationMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    denominator: number;
    metrics: DashboardPenetrationRow[];
  }> {
    const context = await this.resolve(request);
    if (!context.filter) {
      return { verticalId: context.verticalId, denominator: 0, metrics: [] };
    }

    const [denominator, metrics] = await Promise.all([
      this.deps.repository.countProfiles(context.filter),
      this.deps.repository.averageShareByDefinition({ filter: context.filter }),
    ]);

    return { verticalId: context.verticalId, denominator, metrics };
  }
}

/**
 * Clínicas não atribuídas — manager only (spec 0014 §4).
 *
 * REP is refused rather than answered with 0: a rep has no zones, so the
 * question "how much of my territory has nobody working it" is not one they can
 * ask, and a 0 would imply the reassuring answer.
 */
export class GetUnassignedClinicsMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    value: number;
  }> {
    const context = await this.resolve(request);
    if (context.subject.roleName === Role.REP) {
      throw new ForbiddenError();
    }
    if (!context.filter) return { verticalId: context.verticalId, value: 0 };

    return {
      verticalId: context.verticalId,
      value: await this.deps.repository.countProfilesWithoutRep(context.filter),
    };
  }
}

/**
 * The options every filter drawer can currently offer (spec 0014 §5).
 *
 * Each list is computed over the scoped clinic set with **every filter except
 * its own** applied, which is what makes the drawers progressive: choose São
 * Paulo and the municipality list becomes the municipalities of São Paulo that
 * actually hold clinics you can see. Choose a manager and the rep list becomes
 * their reps.
 *
 * A facet omitting its own selection is not a detail — if picking São Paulo
 * collapsed the state list to São Paulo, there would be no way to add Rio, and
 * the drawer would let you make one choice and then trap you in it.
 *
 * `unitTypes` is outside the faceting in both directions: it is the whole
 * catalogue whatever else is selected, and selecting one narrows nothing.
 */
export class GetFilterOptionsUseCase extends DashboardMetricUseCase {
  constructor(
    private readonly filterDeps: Dependencies & {
      listUnitTypes: () => Promise<DashboardFilterOption[]>;
    },
  ) {
    super(filterDeps);
  }

  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    states: DashboardFilterOption[];
    municipalities: DashboardFilterOption[];
    managers: DashboardFilterOption[];
    reps: DashboardFilterOption[];
    unitTypes: DashboardFilterOption[];
  }> {
    // The subject is resolved once and reused by all four facets. It is the
    // same person for every drawer, and re-deriving it per facet cost five
    // `findUser` lookups and five zone lookups for one request.
    const [{ verticalId, denominator }, unitTypes] = await Promise.all([
      this.resolveSubjectScope(request),
      this.filterDeps.listUnitTypes(),
    ]);

    const facet = async (
      offering: DashboardFacet,
      list: (filter: DashboardProfileFilter) => Promise<DashboardFilterOption[]>,
    ) => {
      const resolved = await buildProfileFilter({
        verticalId,
        denominator,
        filters: request.filters,
        directory: this.deps.directory,
        offering,
      });
      return resolved.empty ? [] : list(resolved.filter);
    };

    const [states, municipalities, managers, reps] = await Promise.all([
      facet("state", (f) => this.deps.repository.listStateOptions(f)),
      facet("municipality", (f) =>
        this.deps.repository.listMunicipalityOptions(f),
      ),
      facet("manager", (f) => this.deps.repository.listManagerOptions(f)),
      facet("rep", (f) => this.deps.repository.listRepOptions(f)),
    ]);

    return {
      verticalId,
      states,
      municipalities,
      managers,
      reps,
      unitTypes,
    };
  }
}

export type DashboardMetricKey =
  | "assigned-clinics"
  | "coverage"
  | "cadastro-completion"
  | "unassigned-clinics"
  | "bucket-active"
  | "bucket-inactive"
  | "bucket-never-bought"
  | "cpf-missing"
  | "cpf-invalid";

/**
 * Which funnel stages each donut slice is made of — the **one** definition.
 *
 * The donut counts stages and groups them on the client; this breakdown filters
 * rows on the server. Those are two expressions of the same rule, and when they
 * were written independently they disagreed the moment the grouping moved: the
 * card read "26 Ativas" and the list it opened held 15, because the card had
 * already been regrouped to include OUTSIDE_WINDOW and this predicate had not.
 *
 * Stated here so the drift is impossible to reintroduce silently, and pinned by
 * a database test asserting each slice equals the rows its own drill-down
 * returns. `UNKNOWN` (a profile the funnel has not calculated) is null in SQL
 * and belongs with NEVER_PURCHASED — "no purchase on record", never a lapsed
 * customer.
 *
 * Deliberately not shared with `purchaseBucketToFunnelFilter` in the facility
 * module, which expresses the same three groups for Explorar's filter: they are
 * one rule today and reaching across module boundaries to prove it would couple
 * Desempenho to Explorar's query layer. Kept honest by tests on both sides
 * rather than by an import — if they ever need to differ, nothing has to be
 * untangled first.
 */
export const PURCHASE_BUCKET_STAGES = {
  "bucket-active": ["OUTSIDE_WINDOW", "PURCHASE_WINDOW"],
  "bucket-inactive": ["CHURN", "INACTIVE"],
  "bucket-never-bought": ["NEVER_PURCHASED"],
} as const;

/**
 * Turns the ids this module scoped into the payload Explorar's list serialises.
 *
 * Implemented by the facility module, injected rather than imported, and
 * deliberately typed as opaque here: Desempenho decides *which* clinics; what a
 * clinic looks like on a list row is the facility module's answer, and it
 * already has one.
 *
 * The alternative was teaching this module the fields Explorar shows, which is
 * how the breakdown came to have a row that only resembled Explorar's — the
 * same 44px tile and title, and none of the médicos count, foco clínico or
 * status chips beside them. Two rows for one thing, drifting.
 */
export interface DashboardClinicHydrationPort {
  listByIds(input: {
    ids: number[];
    verticalId: number;
    userId: number;
  }): Promise<{ id: number }[]>;
}

/**
 * The per-clinic breakdown behind a metric card (spec 0014 §4.1).
 *
 * Every metric drills into the same shape, so the screen has one breakdown
 * component rather than seven — and each row links to the clinic profile.
 *
 * The rows are Explorar's, hydrated through [DashboardClinicHydrationPort]:
 * a list of clinics reached from Desempenho and the same list reached from
 * Explorar are the same list, and should not be two designs.
 */
export class ListMetricClinicsUseCase extends DashboardMetricUseCase {
  constructor(
    private readonly listDeps: Dependencies & {
      hydration: DashboardClinicHydrationPort;
    },
  ) {
    super(listDeps);
  }

  async execute(
    request: DashboardMetricRequest & {
      metric: DashboardMetricKey;
      page: number;
      limit: number;
      /**
       * Narrows the list, never the metric.
       *
       * The card's number is the answer to "how many clinics are in this
       * bucket", and typing into the list does not change that — so `total`
       * here follows the search, while the card above stays put. They are two
       * different questions that happen to be one tap apart.
       */
      search?: string;
    },
  ): Promise<{
    verticalId: number;
    data: { id: number }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const context = await this.resolve(request);
    // Before the empty-scope shortcut, so the card and its breakdown refuse a
    // REP for the same reason at the same point: a rep whose scope happened to
    // resolve to nothing would otherwise get an empty list where the card gave
    // them a 403, and an empty list reads as the reassuring answer.
    if (
      request.metric === "unassigned-clinics" &&
      context.subject.roleName === Role.REP
    ) {
      throw new ForbiddenError();
    }
    if (!context.filter) {
      return {
        verticalId: context.verticalId,
        data: [],
        total: 0,
        page: request.page,
        limit: request.limit,
      };
    }

    const { rows, total } = await this.deps.repository.listScopedClinics({
      filter: context.filter,
      predicate: metricPredicate(request.metric),
      search: request.search,
      offset: (request.page - 1) * request.limit,
      limit: request.limit,
    });

    const ids = rows.map((row) => row.facilityId);
    const hydrated = await this.listDeps.hydration.listByIds({
      ids,
      verticalId: context.verticalId,
      userId: request.viewerId,
    });

    // Back into the order this module chose. Hydration is a lookup by id and
    // says nothing about sequence, so taking its order would re-sort the page
    // under the reader — and the pager's "26–50 de 146" only means anything if
    // page 2 holds the 26th to 50th clinic by the same ordering as page 1.
    const byId = new Map(hydrated.map((row) => [row.id, row]));

    return {
      verticalId: context.verticalId,
      data: ids.map((id) => byId.get(id)).filter((row) => row !== undefined),
      total,
      page: request.page,
      limit: request.limit,
    };
  }
}

/**
 * The one extra condition that turns the shared scope into a metric's own set.
 *
 * `coverage` adds nothing — its breakdown is the denominator itself, which is
 * exactly what a user drilling into "247 clínicas" expects to see.
 *
 * `assigned-clinics` used to add nothing either, and had to start: once the card
 * counts clinics that hold a rep, a breakdown over the whole scope would list
 * the unassigned ones too and open a list longer than the number that opened it.
 * It is the exact negation of `unassigned-clinics` on purpose — one rule, two
 * signs — so no clinic can be missing from both lists or present in both.
 */
export function metricPredicateForTest(metric: DashboardMetricKey) {
  return metricPredicate(metric);
}

/** An open rep assignment on the row's profile — the pair's shared predicate. */
const OPEN_REP_ASSIGNMENT = sql`EXISTS (
  SELECT 1 FROM facility_vertical_rep_assignments a
   WHERE a.facility_vertical_profile_id = facility_vertical_profiles.id
     AND a.ended_at IS NULL)`;

function metricPredicate(metric: DashboardMetricKey) {
  switch (metric) {
    case "cadastro-completion":
      return sql`facility_vertical_profiles.conformity_status = 'REGISTERED'`;
    case "assigned-clinics":
      return OPEN_REP_ASSIGNMENT;
    case "unassigned-clinics":
      return sql`NOT ${OPEN_REP_ASSIGNMENT}`;
    case "bucket-active":
    case "bucket-inactive":
      return sql`facility_vertical_profiles.purchase_funnel_stage IN ${stageList(metric)}`;
    case "bucket-never-bought":
      // The only slice that also owns the nulls, so it cannot be expressed by
      // the stage list alone.
      return sql`(facility_vertical_profiles.purchase_funnel_stage IN ${stageList(metric)}
                  OR facility_vertical_profiles.purchase_funnel_stage IS NULL)`;
    case "cpf-missing":
      return sql`(facilities.legal_document_type = 'CPF'
                  AND (facilities.legal_document IS NULL
                       OR btrim(facilities.legal_document) = ''))`;
    case "cpf-invalid":
      return sql`(facilities.legal_document_type = 'CPF'
                  AND facilities.legal_document IS NOT NULL
                  AND btrim(facilities.legal_document) <> ''
                  AND NOT is_valid_cpf(facilities.legal_document))`;
    default:
      return undefined;
  }
}

/** The slice's stages as a SQL list, from the single definition above. */
function stageList(metric: keyof typeof PURCHASE_BUCKET_STAGES) {
  const stages = PURCHASE_BUCKET_STAGES[metric];
  return sql`(${sql.join(
    stages.map((stage) => sql`${stage}`),
    sql`, `,
  )})`;
}

/**
 * The territory card — retained from the previous screen, now scoped by the
 * same subject resolution as every metric.
 *
 * The old "Brasil · visão geral" mode is gone: an admin picks a vertical like
 * everyone else (spec 0014 §3), so there is no cross-vertical national
 * aggregate left to label.
 */
export class GetDashboardTerritoryUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    mode: "global" | "assigned" | "empty";
    label: string | null;
    clinicCount: number;
    doctorCount: number;
    features: DashboardTerritoryFeature[];
  }> {
    const context = await this.resolve(request);
    if (!context.filter) {
      return {
        verticalId: context.verticalId,
        mode: "empty",
        label: null,
        clinicCount: 0,
        doctorCount: 0,
        features: [],
      };
    }

    const isGlobal =
      context.subject.roleName !== Role.REP &&
      context.subject.roleName !== Role.MANAGER;

    const [clinicCount, doctorCount, features] = await Promise.all([
      this.deps.repository.countProfiles(context.filter),
      this.deps.repository.countDoctors(context.filter),
      // The filter travels with the geometry, not only with the counts beside
      // it: the card prints "146 clínicas · 214 médicos" under the map, and
      // those three numbers have to be about the same clinics.
      isGlobal
        ? this.deps.repository.listVerticalTerritoryFeatures({
            verticalId: context.verticalId,
            filter: context.filter,
          })
        : this.deps.repository.listAssignedTerritoryFeatures({
            userId: context.subject.userId,
            verticalId: context.verticalId,
            filter: context.filter,
          }),
    ]);

    const withBoundary = features.filter((f) => f.boundary != null);

    let mode: "global" | "assigned" | "empty";
    let label: string | null;
    if (isGlobal) {
      mode = "global";
      label = null;
    } else if (withBoundary.length > 0) {
      mode = "assigned";
      label =
        withBoundary.length === 1
          ? withBoundary[0]!.name
          : `${withBoundary.length} territórios`;
    } else {
      mode = "empty";
      label = null;
    }

    return {
      verticalId: context.verticalId,
      mode,
      label,
      clinicCount,
      doctorCount,
      features: withBoundary,
    };
  }
}
