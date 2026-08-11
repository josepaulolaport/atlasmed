import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import type { DrizzleTeamRepository, TeamMemberRow } from "../../infrastructure/repositories/drizzle-team.repository";
import type { DashboardDirectoryPort } from "../dashboard-query";
import { resolveSingleVerticalId } from "../dashboard-query";
import type {
  GetAssignedClinicsMetricUseCase,
  GetCadastroCompletionMetricUseCase,
  GetCoverageMetricUseCase,
  GetOrdersMetricUseCase,
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

export interface TeamMemberDto extends TeamMemberRow {
  /**
   * The active sort metric's value for this person, or null when it is not
   * calculable for them. Absent when sorting by name — spec 0014 §6 requires
   * the endpoint to compute **only** the active metric, so there is nothing
   * else to report.
   */
  metricValue: number | null;
}

interface Dependencies {
  teamRepository: DrizzleTeamRepository;
  directory: DashboardDirectoryPort;
  metrics: {
    assignedClinics: GetAssignedClinicsMetricUseCase;
    coverage: GetCoverageMetricUseCase;
    cadastroCompletion: GetCadastroCompletionMetricUseCase;
    orders: GetOrdersMetricUseCase;
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
    const members = await this.loadMembers(request, verticalId);

    const data =
      sortBy === "name"
        ? members.map((member) => ({ ...member, metricValue: null }))
        : await Promise.all(
            members.map(async (member) => ({
              ...member,
              metricValue: await this.metricFor({
                request,
                verticalId,
                member,
                sortBy,
              }),
            })),
          );

    sortMembers(data, sortBy, order);

    return { verticalId, sortBy, order, data };
  }

  private async loadMembers(
    request: ListTeamRequest,
    verticalId: number,
  ): Promise<TeamMemberRow[]> {
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
      return this.deps.teamRepository.listRepsUnderZones({ verticalId, zoneIds });
    }

    if (request.viewerRole === Role.ADMIN || request.viewerRole === Role.OPS) {
      if (request.managerId == null) {
        return this.deps.teamRepository.listManagers(verticalId);
      }
      const zoneIds = await this.deps.directory.findManagerZoneIds({
        userId: request.managerId,
        verticalId,
      });
      return this.deps.teamRepository.listRepsUnderZones({ verticalId, zoneIds });
    }

    // Spec 0014 §2: a REP has no team, so Equipe shows them nothing at all.
    throw new ForbiddenError();
  }

  /**
   * One metric, for one person — never all of them.
   *
   * The cost of the roster is therefore (team size × one query), which is cheap
   * at real team sizes and preserves §4's rule that metrics load separately: a
   * leaderboard that computed seven metrics per member would reintroduce the
   * fat blocking request this spec removed.
   */
  private async metricFor(input: {
    request: ListTeamRequest;
    verticalId: number;
    member: TeamMemberRow;
    sortBy: TeamSortKey;
  }): Promise<number | null> {
    const metricRequest = {
      viewerId: input.request.viewerId,
      viewerRole: input.request.viewerRole,
      scope: input.request.scope,
      verticalId: input.verticalId,
      subjectUserId: input.member.userId,
      filters: {},
    };

    switch (input.sortBy) {
      case "assigned-clinics":
        return (
          await this.deps.metrics.assignedClinics.execute(metricRequest)
        ).value;
      case "coverage":
        return (await this.deps.metrics.coverage.execute(metricRequest)).percent;
      case "cadastro-completion":
        return (
          await this.deps.metrics.cadastroCompletion.execute(metricRequest)
        ).percent;
      case "orders-month":
        return (await this.deps.metrics.orders.execute(metricRequest)).month;
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
