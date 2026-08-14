import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import {
  APPLICATION_TIMEZONE,
  monthBounds,
  monthKeyAt,
} from "@atlasmed/facility-insights";
import { ForbiddenError } from "../../../../shared/errors";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import type {
  DrizzleTeamRepository,
  TeamMemberMetrics,
  TeamMemberProfile,
  TeamMemberRow,
} from "../../infrastructure/repositories/drizzle-team.repository";
import type { DashboardDirectoryPort } from "../dashboard-query";
import { resolveSingleVerticalId } from "../dashboard-query";
import type {
  GetPenetrationMetricUseCase,
  GetUnassignedClinicsMetricUseCase,
} from "./dashboard-metrics.use-cases";

/**
 * What the roster can be sorted by (spec 0014 §6). `name` is the default;
 * anything else turns the roster into a leaderboard and shows that metric's
 * value per person.
 */
export type TeamSortKey =
  | "name"
  | "assigned-clinics"
  | "coverage"
  | "cadastro-completion"
  | "orders-month"
  | "penetration"
  | "unassigned-clinics";

export type TeamOrder = "asc" | "desc";

/**
 * What someone with nothing in scope measures.
 *
 * The counts are zero because they are: a rep with an empty patch holds no
 * clinics and placed no orders. The percentages are null because there is no
 * denominator — 0% would claim they covered none of something, when there was
 * no something.
 */
const HOLDS_NOTHING: TeamMemberMetrics = {
  assignedClinics: 0,
  coveragePercent: null,
  cadastroPercent: null,
  ordersMonth: 0,
};

export interface TeamMemberDto extends TeamMemberRow {
  /**
   * The four metrics every roster row carries, computed for the whole roster in
   * one statement regardless of the sort.
   *
   * Originally the endpoint returned only the metric being sorted by, which
   * made the roster a single-column leaderboard: comparing two people on
   * clinics *and* pedidos meant sorting twice and remembering the first read.
   * Since one pass over the scope produces all four for roughly the cost of
   * one, sorting can go back to meaning order rather than visibility.
   *
   * Always present. Someone holding nothing aggregates to no row at all, and
   * that is a real state with real values — zero clinics, zero pedidos, and no
   * percentage, since there is nothing to take a percentage of. Reporting it as
   * "no data" would sort a rep with an empty patch alongside one whose figures
   * failed to compute.
   */
  metrics: TeamMemberMetrics;
  /**
   * The active sort metric's value, or null when it is not calculable for this
   * person. Still reported separately because two sort keys — penetração and
   * clínicas sem representante — are not row metrics and are computed per
   * member only when they are the sort.
   */
  metricValue: number | null;
}

interface Dependencies {
  teamRepository: DrizzleTeamRepository;
  directory: DashboardDirectoryPort;
  /**
   * Only the two sort keys the batched query cannot produce. The other four
   * come out of `findMemberMetrics`, so the roster no longer depends on the
   * metric use cases it used to call once per member.
   */
  metrics: {
    penetration: GetPenetrationMetricUseCase;
    unassignedClinics: GetUnassignedClinicsMetricUseCase;
  };
}

export interface ListTeamRequest {
  viewerId: number;
  viewerRole: string;
  scope: ScopeContext;
  verticalId?: number | null;
  /** ADMIN only: drill into one manager's team. */
  managerId?: number | null;
  sortBy?: TeamSortKey;
  order?: TeamOrder;
}

/**
 * The roster (spec 0014 §6).
 *
 * A manager sees their reps; an admin sees managers and drills into each
 * manager's team. There are no nested dashboard segments — the drill-down is
 * this roster plus the subject-scoped Desempenho screen, which is why every
 * level renders the same two things.
 */
export class ListTeamUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(request: ListTeamRequest): Promise<{
    verticalId: number;
    sortBy: TeamSortKey;
    order: TeamOrder;
    data: TeamMemberDto[];
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

    const sortBy = request.sortBy ?? "name";
    const order = request.order ?? "asc";
    const roster = await this.loadMembers(request, verticalId);

    // The same month the Desempenho pedidos card uses, so a row and the screen
    // it opens can never disagree about the window.
    const month = monthBounds(monthKeyAt(new Date(), APPLICATION_TIMEZONE));
    const metrics = await this.deps.teamRepository.findMemberMetrics({
      verticalId,
      userIds: roster.members.map((member) => member.userId),
      scope: roster.scope,
      withinZoneIds: roster.withinZoneIds,
      ordersFrom: month.start,
      ordersTo: month.end,
    });

    const data: TeamMemberDto[] = await Promise.all(
      roster.members.map(async (member) => {
        const row = metrics.get(member.userId) ?? HOLDS_NOTHING;
        return {
          ...member,
          metrics: row,
          metricValue: await this.metricFor({
            request,
            verticalId,
            member,
            sortBy,
            batched: row,
          }),
        };
      }),
    );

    sortMembers(data, sortBy, order);

    return { verticalId, sortBy, order, data };
  }

  /**
   * The roster, which denominator its metrics are measured against, and the
   * ground the reader is accountable for.
   *
   * The scope is a property of who is *listed*, not of who is looking: an admin
   * viewing managers gets zone-scoped figures, and the same admin drilled into
   * one manager's team gets assignment-scoped ones.
   *
   * `withinZoneIds` is the second half of that (spec 0015 R1) — a rep roster is
   * always somebody's roster, so it narrows to the zones the list was built
   * from. It is the same set that selected the members, which is what makes the
   * header equal the sum of its rows.
   */
  private async loadMembers(
    request: ListTeamRequest,
    verticalId: number,
  ): Promise<{
    members: TeamMemberRow[];
    scope: "rep" | "manager";
    withinZoneIds: number[] | null;
  }> {
    if (request.viewerRole === Role.MANAGER) {
      // A manager's roster is their own reps. `managerId` cannot widen it:
      // pointing it at a peer would be a lateral read of someone else's team.
      if (
        request.managerId != null &&
        request.managerId !== request.viewerId
      ) {
        throw new ForbiddenError();
      }
      const zoneIds = await this.deps.directory.findManagerZoneIds({
        userId: request.viewerId,
        verticalId,
      });
      return {
        members: await this.deps.teamRepository.listRepsUnderZones({
          verticalId,
          zoneIds,
        }),
        scope: "rep",
        withinZoneIds: zoneIds,
      };
    }

    if (request.viewerRole === Role.ADMIN || request.viewerRole === Role.OPS) {
      if (request.managerId == null) {
        return {
          members: await this.deps.teamRepository.listManagers(verticalId),
          scope: "manager",
          // A manager IS the ground; there is nothing further to narrow to.
          withinZoneIds: null,
        };
      }
      const zoneIds = await this.deps.directory.findManagerZoneIds({
        userId: request.managerId,
        verticalId,
      });
      return {
        members: await this.deps.teamRepository.listRepsUnderZones({
          verticalId,
          zoneIds,
        }),
        scope: "rep",
        withinZoneIds: zoneIds,
      };
    }

    // Spec 0014 §2: a REP has no team, so Equipe shows them nothing at all.
    throw new ForbiddenError();
  }

  /**
   * The value the sort orders by.
   *
   * The four row metrics come straight out of the batch — no query at all. Only
   * penetração and clínicas sem representante still cost a request per member,
   * because neither is a count over the roster's own scope: penetração averages
   * a stored share per metric definition, and unassigned clinics is a property
   * of a zone rather than of a person. Both are computed only when they are the
   * active sort, so the common paths issue exactly one statement.
   */
  private async metricFor(input: {
    request: ListTeamRequest;
    verticalId: number;
    member: TeamMemberRow;
    sortBy: TeamSortKey;
    batched: TeamMemberMetrics;
  }): Promise<number | null> {
    switch (input.sortBy) {
      case "name":
        return null;
      case "assigned-clinics":
        return input.batched.assignedClinics;
      case "coverage":
        return input.batched.coveragePercent;
      case "cadastro-completion":
        return input.batched.cadastroPercent;
      case "orders-month":
        return input.batched.ordersMonth;
    }

    const metricRequest = {
      viewerId: input.request.viewerId,
      viewerRole: input.request.viewerRole,
      scope: input.request.scope,
      verticalId: input.verticalId,
      subjectUserId: input.member.userId,
      filters: {},
    };

    switch (input.sortBy) {
      case "penetration": {
        const result = await this.deps.metrics.penetration.execute(metricRequest);
        // A vertical may define several metrics and they are not addable
        // (spec 0013 §4.2 — one `metric_units` per product per metric). The
        // roster sorts by the first defined metric; the per-person breakdown is
        // the Desempenho screen, which shows all of them.
        return result.metrics[0]?.meanShare ?? null;
      }
      case "unassigned-clinics":
        // Only meaningful for a manager; a rep holds no zones.
        if (input.member.roleName === Role.REP) return null;
        return (
          await this.deps.metrics.unassignedClinics.execute(metricRequest)
        ).value;
      default:
        return null;
    }
  }
}

/**
 * Nulls sort last in both directions.
 *
 * A person whose metric could not be calculated is not the best performer and
 * not the worst — putting them at the bottom of an ascending sort would read as
 * "worst", which is a claim the data does not support.
 */
function sortMembers(
  data: TeamMemberDto[],
  sortBy: TeamSortKey,
  order: TeamOrder,
): void {
  const direction = order === "desc" ? -1 : 1;

  data.sort((a, b) => {
    if (sortBy === "name") {
      return direction * (a.name ?? "").localeCompare(b.name ?? "", "pt-BR");
    }
    if (a.metricValue === null && b.metricValue === null) return 0;
    if (a.metricValue === null) return 1;
    if (b.metricValue === null) return -1;
    return direction * (a.metricValue - b.metricValue);
  });
}

/**
 * One member's profile (spec 0015 §4).
 *
 * Equipe answers *who*; this is that answer in full. It carries no metric the
 * Desempenho screen owns — the cards link there instead — and nothing here is
 * editable: identity belongs to `Usuários`, territory to the map.
 *
 * Authorisation is the roster's rule, not a second one: a REP has no team, a
 * MANAGER may only open someone their zones already contain, and ADMIN/OPS may
 * open anyone. Reusing `managedUserIds` is what keeps the two from drifting —
 * a profile reachable by someone the roster would never list is a hole.
 */
export class GetTeamMemberUseCase {
  constructor(
    private readonly deps: Pick<Dependencies, "teamRepository" | "directory">,
  ) {}

  async execute(request: {
    viewerId: number;
    viewerRole: string;
    scope: ScopeContext;
    subjectUserId: number;
    verticalId?: number | null;
  }): Promise<TeamMemberProfile> {
    const accessibleVerticalIds = resolveVerticalIds({
      role: request.viewerRole,
      assignedVerticalIds: request.scope.assignedVerticalIds ?? [],
      queryVerticalId: request.verticalId ?? null,
    });
    const verticalId = resolveSingleVerticalId({
      requestedVerticalId: request.verticalId ?? null,
      accessibleVerticalIds,
    });

    if (request.viewerRole === Role.REP) {
      throw new ForbiddenError();
    }
    if (
      request.viewerRole === Role.MANAGER &&
      request.subjectUserId !== request.viewerId &&
      !(request.scope.managedUserIds ?? []).includes(request.subjectUserId)
    ) {
      throw new ForbiddenError();
    }
    if (
      request.viewerRole !== Role.MANAGER &&
      request.viewerRole !== Role.ADMIN &&
      request.viewerRole !== Role.OPS
    ) {
      throw new ForbiddenError();
    }

    // Spec 0015 R1 again: a manager reads their share of the person, and it is
    // derived from who is asking rather than accepted from them.
    const withinZoneIds =
      request.viewerRole === Role.MANAGER
        ? await this.deps.directory.findManagerZoneIds({
            userId: request.viewerId,
            verticalId,
          })
        : null;

    const member = await this.deps.teamRepository.findMember({
      userId: request.subjectUserId,
      verticalId,
      withinZoneIds,
    });

    // A member the reader may reach but who has nothing in their ground is not
    // a 404 of identity — but there is no profile to show under this scope, and
    // saying so beats rendering an empty one.
    if (!member) throw new ForbiddenError();

    return member;
  }
}

/**
 * Reps with no active patch (spec 0009 R8/D9).
 *
 * ADMIN only, because a rep with no patch is under no manager by definition —
 * there is no team this roster could belong to.
 */
export class ListRepsWithoutPatchUseCase {
  constructor(
    private readonly deps: Pick<Dependencies, "teamRepository">,
  ) {}

  async execute(request: {
    viewerRole: string;
  }): Promise<{ data: TeamMemberRow[] }> {
    if (request.viewerRole !== Role.ADMIN) {
      throw new ForbiddenError();
    }
    return { data: await this.deps.teamRepository.listRepsWithoutPatch() };
  }
}
