import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import {
  APPLICATION_TIMEZONE,
  monthBounds,
  monthKeyAt,
  trailingMonths,
} from "@atlasmed/facility-insights";
import { sql } from "drizzle-orm";
import { ForbiddenError } from "../../../../shared/errors";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import type {
  DashboardClinicRow,
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
  type DashboardDirectoryPort,
  type DashboardFilters,
  type DashboardProfileFilter,
  type DashboardSubject,
} from "../dashboard-query";

/**
 * How many calendar months penetração média averages over.
 *
 * The same read-side window the clinic screen uses (spec 0013 §4.3). Two
 * different windows would make a manager's average disagree with the clinics it
 * averages, for no reason a user could discover.
 */
const MONTHS_IN_WINDOW = 3;

export interface DashboardMetricRequest {
  viewerId: number;
  viewerRole: string;
  scope: ScopeContext;
  verticalId?: number | null;
  /** Spec 0014 §2: whose desempenho — omitted means the viewer's own. */
  subjectUserId?: number | null;
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

  protected async resolve(
    request: DashboardMetricRequest,
  ): Promise<DashboardMetricContext> {
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
    });

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

/** Clínicas atribuídas — count of profiles in scope. */
export class GetAssignedClinicsMetricUseCase extends DashboardMetricUseCase {
  async execute(request: DashboardMetricRequest): Promise<{
    verticalId: number;
    value: number;
  }> {
    const context = await this.resolve(request);
    if (!context.filter) return { verticalId: context.verticalId, value: 0 };
    return {
      verticalId: context.verticalId,
      value: await this.deps.repository.countProfiles(context.filter),
    };
  }
}

/**
 * Cobertura — clinics that have **ever bought**, over the denominator.
 *
 * `(active + inactive) ÷ denominator`, where the buckets come from
 * `purchase_funnel_stage`. Percent is null rather than 0 when the denominator
 * is empty: a rep with no clinics has no coverage figure, and 0% would read as
 * a failure rather than an absence.
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
      : { active: 0, inactive: 0, neverBought: 0, total: 0 };

    const covered = buckets.active + buckets.inactive;
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
        : { active: 0, inactive: 0, neverBought: 0, total: 0 },
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
 */
export class GetPenetrationMetricUseCase extends DashboardMetricUseCase {
  async execute(
    request: DashboardMetricRequest & { now?: Date },
  ): Promise<{
    verticalId: number;
    denominator: number;
    metrics: DashboardPenetrationRow[];
  }> {
    const context = await this.resolve(request);
    if (!context.filter) {
      return { verticalId: context.verticalId, denominator: 0, metrics: [] };
    }

    const months = trailingMonths(
      monthKeyAt(request.now ?? new Date(), APPLICATION_TIMEZONE),
      MONTHS_IN_WINDOW,
    );

    const [denominator, metrics] = await Promise.all([
      this.deps.repository.countProfiles(context.filter),
      this.deps.repository.averageShareByDefinition({
        filter: context.filter,
        months,
      }),
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

export type DashboardMetricKey =
  | "assigned-clinics"
  | "coverage"
  | "cadastro-completion"
  | "unassigned-clinics"
  | "bucket-active"
  | "bucket-inactive"
  | "bucket-never-bought";

/**
 * The per-clinic breakdown behind a metric card (spec 0014 §4.1).
 *
 * Every metric drills into the same shape, so the screen has one breakdown
 * component rather than seven — and each row links to the clinic profile.
 */
export class ListMetricClinicsUseCase extends DashboardMetricUseCase {
  async execute(
    request: DashboardMetricRequest & {
      metric: DashboardMetricKey;
      page: number;
      limit: number;
    },
  ): Promise<{
    verticalId: number;
    data: DashboardClinicRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const context = await this.resolve(request);
    if (!context.filter) {
      return {
        verticalId: context.verticalId,
        data: [],
        total: 0,
        page: request.page,
        limit: request.limit,
      };
    }
    if (
      request.metric === "unassigned-clinics" &&
      context.subject.roleName === Role.REP
    ) {
      throw new ForbiddenError();
    }

    const { rows, total } = await this.deps.repository.listScopedClinics({
      filter: context.filter,
      predicate: metricPredicate(request.metric),
      offset: (request.page - 1) * request.limit,
      limit: request.limit,
    });

    return {
      verticalId: context.verticalId,
      data: rows,
      total,
      page: request.page,
      limit: request.limit,
    };
  }
}

/**
 * The one extra condition that turns the shared scope into a metric's own set.
 *
 * `assigned-clinics` and `coverage` add nothing — their breakdown is the
 * denominator itself, which is exactly what a user drilling into "247 clínicas"
 * expects to see.
 */
function metricPredicate(metric: DashboardMetricKey) {
  switch (metric) {
    case "cadastro-completion":
      return sql`facility_vertical_profiles.conformity_status = 'REGISTERED'`;
    case "unassigned-clinics":
      return sql`NOT EXISTS (
        SELECT 1 FROM facility_vertical_rep_assignments a
         WHERE a.facility_vertical_profile_id = facility_vertical_profiles.id
           AND a.ended_at IS NULL)`;
    case "bucket-active":
      return sql`facility_vertical_profiles.purchase_funnel_stage = 'PURCHASE_WINDOW'`;
    case "bucket-inactive":
      return sql`facility_vertical_profiles.purchase_funnel_stage IN ('OUTSIDE_WINDOW', 'CHURN')`;
    case "bucket-never-bought":
      return sql`(facility_vertical_profiles.purchase_funnel_stage IN ('NEVER_PURCHASED', 'INACTIVE')
                  OR facility_vertical_profiles.purchase_funnel_stage IS NULL)`;
    default:
      return undefined;
  }
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
      isGlobal
        ? this.deps.repository.listVerticalTerritoryFeatures(context.verticalId)
        : this.deps.repository.listAssignedTerritoryFeatures({
            userId: context.subject.userId,
            verticalId: context.verticalId,
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
