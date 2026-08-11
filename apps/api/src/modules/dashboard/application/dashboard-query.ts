import { Role } from "@atlasmed/access";
import { ForbiddenError, ValidationError } from "../../../shared/errors";

/**
 * Who the numbers are *about* — spec 0014 §3.
 *
 * A denominator is role-dependent, not a facility id list: a rep is measured on
 * the clinics **assigned** to them, a manager on the clinics **in their zones**.
 * Those are different questions, and the previous dashboard could express
 * neither — it passed `scope.facilityIds` (oversight visibility) for everyone
 * and `null` for ADMIN, which is how "Brasil · visão geral" came to be an
 * unbounded cross-vertical aggregate.
 */
export type DashboardDenominator =
  /** Every profile in the vertical. ADMIN with no subject, and OPS. */
  | { kind: "global" }
  /** Profiles with an open rep assignment to this user. */
  | { kind: "rep"; userId: number }
  /** Profiles whose derived manager zone is one of these. */
  | { kind: "zones"; zoneIds: number[] };

export interface DashboardFilters {
  unitTypeId?: number | null;
  managerId?: number | null;
  repId?: number | null;
  stateId?: number | null;
  municipalityId?: number | null;
}

/**
 * What every metric endpoint receives after scope and filters collapse into one
 * predicate over `facility_vertical_profiles`.
 *
 * `empty` is a first-class outcome rather than an impossible filter combination
 * pushed to the database: asking for "rep 5's clinics, filtered to rep 7"
 * has an answer, and the answer is nothing. Encoding it here keeps the SQL from
 * having to express a contradiction.
 */
export type DashboardProfileFilter = {
  verticalId: number;
  /** Null = unrestricted. Empty array = nothing matches (a manager with no zones). */
  zoneIds: number[] | null;
  /** Null = unrestricted; otherwise requires an open assignment to this user. */
  repUserId: number | null;
  stateId: number | null;
  municipalityId: number | null;
  unitTypeId: number | null;
};

export interface DashboardSubject {
  userId: number;
  roleName: string;
}

/**
 * Reads a user's role and manager zones. Implemented in infrastructure; the
 * resolution rules below stay pure and unit-testable.
 */
export interface DashboardDirectoryPort {
  findUser(userId: number): Promise<DashboardSubject | null>;
  /** Manager-zone territory ids this user holds in one vertical. */
  findManagerZoneIds(input: {
    userId: number;
    verticalId: number;
  }): Promise<number[]>;
  /** REPs holding a patch under this manager's zones. */
  findManagedUserIds(managerId: number): Promise<number[]>;
}

/**
 * Exactly one vertical, always (spec 0014 §3).
 *
 * Two linhas in one number is meaningless, so there is no "todas" option and no
 * ADMIN special case — an admin picks a vertical like everyone else. The caller
 * may omit it only when they have exactly one, which is the case that would
 * otherwise force a pointless selector on most reps.
 */
export function resolveSingleVerticalId(input: {
  requestedVerticalId?: number | null;
  accessibleVerticalIds: number[];
}): number {
  const requested = input.requestedVerticalId ?? null;
  if (requested !== null) {
    if (!input.accessibleVerticalIds.includes(requested)) {
      throw new ForbiddenError();
    }
    return requested;
  }
  if (input.accessibleVerticalIds.length === 1) {
    return input.accessibleVerticalIds[0]!;
  }
  throw new ValidationError([
    {
      field: "verticalId",
      message:
        "verticalId is required: a dashboard never mixes two linhas, and you have more than one",
    },
  ]);
}

/**
 * Whether the viewer may see another person's numbers, and whose numbers those
 * turn out to be.
 *
 * A manager reaches their own reps only; an admin reaches anyone. This is the
 * check behind spec 0014 §2's "→ perfil → Ver desempenho": the drill-down is a
 * scope change, so it is an authorization decision, not a UI one.
 *
 * OPS reaches anyone too. Spec 0014 §2's table does not list OPS, but the
 * roster does (`ListTeamUseCase` lets it read the manager list), and a role
 * that may list the team but not compute a single row of it fails the whole
 * request the moment the roster is sorted by a metric — a 403 for asking a
 * question the same screen already invited. OPS reads every clinic in its
 * verticals already (`resolveOpsScope`), so this widens no data.
 */
export async function resolveSubject(input: {
  viewer: DashboardSubject;
  subjectUserId?: number | null;
  managedUserIds: number[];
  directory: DashboardDirectoryPort;
}): Promise<DashboardSubject> {
  const requested = input.subjectUserId ?? null;
  if (requested === null || requested === input.viewer.userId) {
    return input.viewer;
  }

  if (input.viewer.roleName === Role.REP) {
    throw new ForbiddenError();
  }
  if (
    input.viewer.roleName === Role.MANAGER &&
    !input.managedUserIds.includes(requested)
  ) {
    throw new ForbiddenError();
  }
  if (
    input.viewer.roleName !== Role.ADMIN &&
    input.viewer.roleName !== Role.MANAGER &&
    input.viewer.roleName !== Role.OPS
  ) {
    throw new ForbiddenError();
  }

  const subject = await input.directory.findUser(requested);
  if (!subject) {
    throw new ForbiddenError();
  }
  return subject;
}

/**
 * The denominator a subject's role implies (spec 0014 §3).
 *
 * OPS resolves to `global`: it cannot be assigned to a territory at all
 * (spec 0010 §2.3), so it is vertical-wide by construction — and the vertical
 * is always pinned, so "global" here is never national-across-linhas the way
 * the old ADMIN branch was.
 */
export async function resolveDenominator(input: {
  subject: DashboardSubject;
  verticalId: number;
  directory: DashboardDirectoryPort;
}): Promise<DashboardDenominator> {
  switch (input.subject.roleName) {
    case Role.REP:
      return { kind: "rep", userId: input.subject.userId };
    case Role.MANAGER: {
      const zoneIds = await input.directory.findManagerZoneIds({
        userId: input.subject.userId,
        verticalId: input.verticalId,
      });
      return { kind: "zones", zoneIds };
    }
    default:
      return { kind: "global" };
  }
}

export type ResolvedDashboardQuery =
  | { empty: true }
  | { empty: false; filter: DashboardProfileFilter };

/**
 * Collapses denominator + filters into the single predicate every metric shares.
 *
 * Filters narrow; they never widen. A manager filtering by another manager sees
 * the intersection of the two zone sets — which is normally nothing, and saying
 * nothing is correct.
 */
export async function buildProfileFilter(input: {
  verticalId: number;
  denominator: DashboardDenominator;
  filters: DashboardFilters;
  directory: DashboardDirectoryPort;
}): Promise<ResolvedDashboardQuery> {
  let zoneIds: number[] | null =
    input.denominator.kind === "zones" ? input.denominator.zoneIds : null;
  let repUserId: number | null =
    input.denominator.kind === "rep" ? input.denominator.userId : null;

  if (input.filters.managerId != null) {
    const filterZoneIds = await input.directory.findManagerZoneIds({
      userId: input.filters.managerId,
      verticalId: input.verticalId,
    });
    zoneIds =
      zoneIds === null
        ? filterZoneIds
        : zoneIds.filter((id) => filterZoneIds.includes(id));
  }

  if (input.filters.repId != null) {
    // Two different reps cannot both hold a profile: the schema allows exactly
    // one open assignment per profile.
    if (repUserId !== null && repUserId !== input.filters.repId) {
      return { empty: true };
    }
    repUserId = input.filters.repId;
  }

  if (zoneIds !== null && zoneIds.length === 0) {
    return { empty: true };
  }

  return {
    empty: false,
    filter: {
      verticalId: input.verticalId,
      zoneIds,
      repUserId,
      stateId: input.filters.stateId ?? null,
      municipalityId: input.filters.municipalityId ?? null,
      unitTypeId: input.filters.unitTypeId ?? null,
    },
  };
}
