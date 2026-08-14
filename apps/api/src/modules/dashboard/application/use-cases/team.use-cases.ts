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
  AssignableClinicRow,
  DrizzleTeamRepository,
  TeamMemberMetrics,
  TeamMemberProfile,
  TeamMemberRow,
  TerritoryFeature,
} from "../../infrastructure/repositories/drizzle-team.repository";
import type { DashboardDirectoryPort } from "../dashboard-query";
import { resolveSingleVerticalId } from "../dashboard-query";
import type {
  GetAssignedClinicsMetricUseCase,
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
    private readonly deps: Pick<Dependencies, "teamRepository" | "directory"> & {
      /**
       * The counts come from the metric use cases rather than from SQL of their
       * own.
       *
       * `clínicas` and `sem representante` already have one definition each —
       * `countProfiles` and `countProfilesWithoutRep`, reached through the same
       * denominator resolution every card uses. Writing them again here gave two
       * spellings of one business number, which is the drift this codebase keeps
       * warning about: the copy that is wrong is the one nobody is comparing.
       *
       * A profile is one person, so two extra queries buy correctness cheaply.
       * The roster keeps its batch (N+1 otherwise) and a database test pins the
       * two readings together.
       */
      metrics: {
        assignedClinics: GetAssignedClinicsMetricUseCase;
        unassignedClinics: GetUnassignedClinicsMetricUseCase;
      };
    },
  ) {}

  async execute(request: {
    viewerId: number;
    viewerRole: string;
    scope: ScopeContext;
    subjectUserId: number;
    verticalId?: number | null;
    /** ADMIN drill-down: whose team this person was reached through. */
    viaManagerId?: number | null;
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

    // The role decides the denominator (spec 0014 §3), so it has to be known
    // before the counts are taken rather than inferred from them.
    const subject = await this.deps.directory.findUser(request.subjectUserId);
    if (!subject) throw new ForbiddenError();

    const isRep = subject.roleName === Role.REP;
    const member = await this.deps.teamRepository.findMember({
      userId: request.subjectUserId,
      verticalId,
      withinZoneIds,
    });

    // A member the reader may reach but who has nothing in their ground is not
    // a 404 of identity — but there is no profile to show under this scope, and
    // saying so beats rendering an empty one.
    if (!member) throw new ForbiddenError();

    const metricRequest = {
      viewerId: request.viewerId,
      viewerRole: request.viewerRole,
      scope: request.scope,
      verticalId,
      subjectUserId: request.subjectUserId,
      // Spec 0015 R2: the same share of the person the rest of the screen
      // shows. Derived from the viewer for a manager, so passing it is only
      // meaningful for an admin who drilled through a team.
      withinManagerId: request.viaManagerId ?? null,
      filters: {},
    };

    const [assigned, unassigned] = await Promise.all([
      this.deps.metrics.assignedClinics.execute(metricRequest),
      // A clinic nobody holds is a zone question. A rep's denominator cannot
      // contain one, so there is nothing to ask them about.
      isRep
        ? Promise.resolve(null)
        : this.deps.metrics.unassignedClinics.execute(metricRequest),
    ]);

    return {
      ...member,
      assignedClinicCount: assigned.value,
      unassignedClinicCount: unassigned?.value ?? null,
    };
  }
}

/**
 * What the member's territory map draws (spec 0015 §6).
 *
 * Three sets, because the map answers three questions at once: what this person
 * holds, what encloses it, and what is already taken. Which sets are populated
 * depends on who is looking at whom — R9's table, expressed once here rather
 * than re-derived by the screen.
 */
export interface MemberTerritoryMap {
  /** This person's own territories: a rep's patches, a manager's zones. */
  subject: TerritoryFeature[];
  /**
   * The zone that encloses them, outlined with everything outside greyed.
   * Empty for an admin looking at a manager — a zone encloses nothing.
   */
  context: TerritoryFeature[];
  /**
   * Other managers' zones, shaded as unavailable. Only for an admin looking at
   * a manager, where the question is where a zone may grow (I3 forbids
   * overlap, so it grows only into unclaimed ground).
   */
  taken: TerritoryFeature[];
  /**
   * Whether this viewer may redraw what they are looking at.
   *
   * A manager may redraw a patch and never a zone — zone geometry is ADMIN-only
   * (spec 0009 §3.3) — and OPS may redraw nothing (R3).
   *
   * Where a new patch would go is not a separate field: `context` already lists
   * the zones it could belong to, and I4 says it must sit in exactly one, so
   * the screen asks when there is more than one rather than the server guessing
   * or, worse, declining to offer creation at all.
   */
  canEdit: boolean;
}

export class GetMemberTerritoryMapUseCase {
  constructor(
    private readonly deps: Pick<Dependencies, "teamRepository" | "directory">,
  ) {}

  async execute(request: {
    viewerId: number;
    viewerRole: string;
    scope: ScopeContext;
    subjectUserId: number;
    verticalId?: number | null;
    /** ADMIN drill-down: the manager whose team this person was reached by. */
    viaManagerId?: number | null;
  }): Promise<MemberTerritoryMap> {
    const accessibleVerticalIds = resolveVerticalIds({
      role: request.viewerRole,
      assignedVerticalIds: request.scope.assignedVerticalIds ?? [],
      queryVerticalId: request.verticalId ?? null,
    });
    const verticalId = resolveSingleVerticalId({
      requestedVerticalId: request.verticalId ?? null,
      accessibleVerticalIds,
    });

    if (request.viewerRole === Role.REP) throw new ForbiddenError();
    if (
      request.viewerRole === Role.MANAGER &&
      request.subjectUserId !== request.viewerId &&
      !(request.scope.managedUserIds ?? []).includes(request.subjectUserId)
    ) {
      throw new ForbiddenError();
    }

    const subject = await this.deps.directory.findUser(request.subjectUserId);
    if (!subject) throw new ForbiddenError();

    // OPS reads and never draws (R3); a manager may redraw a patch but never a
    // zone, which stays admin-only (spec 0009 §3.3).
    const isRepSubject = subject.roleName === Role.REP;
    const canEdit =
      request.viewerRole === Role.ADMIN ||
      (request.viewerRole === Role.MANAGER && isRepSubject);

    if (!isRepSubject) {
      // An admin looking at a manager: their zones, and everyone else's shaded.
      const zoneIds = await this.deps.directory.findManagerZoneIds({
        userId: request.subjectUserId,
        verticalId,
      });
      const [ownZones, taken] = await Promise.all([
        this.deps.teamRepository.listZoneFeatures(zoneIds),
        this.deps.teamRepository.listOtherZoneFeatures({
          verticalId,
          exceptZoneIds: zoneIds,
        }),
      ]);
      return {
        subject: ownZones,
        context: [],
        taken,
        canEdit,
      };
    }

    // A rep, seen from inside somebody's ground. The enclosing zone is the
    // viewer's own when a manager is looking, and the team they drilled through
    // when an admin is — so an admin sees the rep as that manager does (R9).
    const contextManagerId =
      request.viewerRole === Role.MANAGER
        ? request.viewerId
        : (request.viaManagerId ?? null);

    const contextZoneIds = contextManagerId
      ? await this.deps.directory.findManagerZoneIds({
          userId: contextManagerId,
          verticalId,
        })
      : null;

    const [patches, context] = await Promise.all([
      this.deps.teamRepository.listTerritoryFeatures({
        userId: request.subjectUserId,
        verticalId,
        typeSlug: "patch",
        withinZoneIds: contextZoneIds,
      }),
      contextZoneIds
        ? this.deps.teamRepository.listZoneFeatures(contextZoneIds)
        : Promise.resolve([]),
    ]);

    return {
      subject: patches,
      context,
      taken: [],
      canEdit,
    };
  }
}

/**
 * Clinics a member could be given (spec 0015 R6).
 *
 * Only a REP can hold clinics, so this refuses a manager subject rather than
 * returning an empty list — an empty list reads as "none available", which is a
 * different and wrong answer.
 */
export class ListAssignableClinicsUseCase {
  constructor(
    private readonly deps: Pick<Dependencies, "teamRepository" | "directory">,
  ) {}

  async execute(request: {
    viewerId: number;
    viewerRole: string;
    scope: ScopeContext;
    subjectUserId: number;
    verticalId?: number | null;
    mode?: "patch" | "search";
    search?: string | null;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AssignableClinicRow[];
    pagination: { page: number; limit: number; total: number };
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

    // OPS reads everything and changes nothing (spec 0015 R3), so it has no
    // business being offered a list whose only purpose is to assign from.
    if (
      request.viewerRole !== Role.ADMIN &&
      request.viewerRole !== Role.MANAGER
    ) {
      throw new ForbiddenError();
    }
    if (
      request.viewerRole === Role.MANAGER &&
      !(request.scope.managedUserIds ?? []).includes(request.subjectUserId)
    ) {
      throw new ForbiddenError();
    }

    const subject = await this.deps.directory.findUser(request.subjectUserId);
    if (!subject || subject.roleName !== Role.REP) {
      throw new ForbiddenError();
    }

    const withinZoneIds =
      request.viewerRole === Role.MANAGER
        ? await this.deps.directory.findManagerZoneIds({
            userId: request.viewerId,
            verticalId,
          })
        : null;

    const page = request.page ?? 1;
    const limit = request.limit ?? 25;
    const mode = request.mode ?? "patch";
    const search = request.search?.trim() || null;

    // The search door needs a term. Without one it scans the whole vertical and
    // runs the coverage test on every row — measured at ~770ms against 1.4k
    // clinics, versus ~30ms with a term. It is also the wrong answer: "every
    // clinic in the linha" is not a list anyone was asking for. The screen
    // prompts instead.
    if (mode === "search" && search === null) {
      return { data: [], pagination: { page, limit, total: 0 } };
    }

    const { rows, total } =
      await this.deps.teamRepository.listAssignableClinics({
        userId: request.subjectUserId,
        verticalId,
        mode,
        search,
        withinZoneIds,
        offset: (page - 1) * limit,
        limit,
      });

    return { data: rows, pagination: { page, limit, total } };
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
