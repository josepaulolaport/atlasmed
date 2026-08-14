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
  /**
   * Profiles with an open rep assignment to this user.
   *
   * `withinZoneIds` narrows that to the part of the rep a particular manager is
   * accountable for. A rep may hold patches under two managers (I4 puts each
   * patch in exactly one zone, but says nothing about how many zones a person
   * may appear in), and without this the answer would be "every clinic this
   * person holds anywhere" — which for a manager means clinics they cannot act
   * on, and numbers that do not reconcile with their own.
   */
  | { kind: "rep"; userId: number; withinZoneIds?: number[] | null }
  /** Profiles whose derived manager zone is one of these. */
  | { kind: "zones"; zoneIds: number[] };

/**
 * The filter set (spec 0014 §5), every value multi-select.
 *
 * Singular and plural are both accepted and merged. The singular names are what
 * shipped, and installed mobile builds still send them; dropping them would
 * make every already-installed app filter by nothing at all, silently, which is
 * worse than the small ugliness of carrying both for a release.
 */
export interface DashboardFilters {
  unitTypeId?: number | null;
  managerId?: number | null;
  repId?: number | null;
  stateId?: number | null;
  municipalityId?: number | null;
  unitTypeIds?: number[] | null;
  managerIds?: number[] | null;
  repIds?: number[] | null;
  stateIds?: number[] | null;
  municipalityIds?: number[] | null;
}

/** Merges the singular and plural forms of one filter into a distinct list. */
function selected(
  one: number | null | undefined,
  many: number[] | null | undefined,
): number[] {
  const values = [...(many ?? [])];
  if (one != null) values.push(one);
  return [...new Set(values)];
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
  /** Null = unrestricted; otherwise requires an open assignment to one of these users. */
  repUserIds: number[] | null;
  stateIds: number[] | null;
  municipalityIds: number[] | null;
  unitTypeIds: number[] | null;
};

/**
 * Which facet is being *offered* rather than applied (spec 0014 §5).
 *
 * A facet never restricts its own option list. If picking São Paulo collapsed
 * the state list to São Paulo, there would be no way to add Rio as a second
 * value — the drawer would let you make exactly one choice and then trap you in
 * it. So each list is computed with every filter applied *except* its own.
 *
 * `unitType` is absent on purpose: it sits outside faceting in both directions,
 * so its options are the whole catalogue and it never narrows anything else.
 */
export type DashboardFacet = "state" | "municipality" | "manager" | "rep";

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
  /** Who is asking. A MANAGER only ever sees their own share of a rep. */
  viewer?: DashboardSubject;
  /**
   * ADMIN only: the manager whose team this rep was reached through, so an
   * admin drilling Equipe → gestor → representante keeps reading the same
   * population the roster row showed. A MANAGER cannot pass this — their
   * constraint is themselves, derived below rather than accepted from input.
   */
  withinManagerId?: number | null;
}): Promise<DashboardDenominator> {
  switch (input.subject.roleName) {
    case Role.REP: {
      // Derived from the viewer, never from the request, so a manager cannot
      // widen their own scope by asking. ADMIN and OPS hold authority across
      // every zone, so for them the constraint is only the explicit one.
      const constrainToManagerId =
        input.viewer?.roleName === Role.MANAGER
          ? input.viewer.userId
          : (input.withinManagerId ?? null);

      if (constrainToManagerId === null) {
        return { kind: "rep", userId: input.subject.userId };
      }
      return {
        kind: "rep",
        userId: input.subject.userId,
        withinZoneIds: await input.directory.findManagerZoneIds({
          userId: constrainToManagerId,
          verticalId: input.verticalId,
        }),
      };
    }
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
  /** Omit this facet's own selection — used to build its option list. */
  offering?: DashboardFacet;
}): Promise<ResolvedDashboardQuery> {
  const managerIds =
    input.offering === "manager"
      ? []
      : selected(input.filters.managerId, input.filters.managerIds);
  const repIds =
    input.offering === "rep"
      ? []
      : selected(input.filters.repId, input.filters.repIds);
  const stateIds =
    input.offering === "state"
      ? []
      : selected(input.filters.stateId, input.filters.stateIds);
  const municipalityIds =
    input.offering === "municipality"
      ? []
      : selected(input.filters.municipalityId, input.filters.municipalityIds);
  // Unit type sits outside the faceting in *both* directions, so it is omitted
  // whenever any facet is being offered — not just its own. Applying it here
  // would make choosing "Hospital Geral" shrink the state, município, gestor and
  // representante drawers, which is exactly the influence it is meant not to
  // have. It still filters every metric; it just does not decide what the other
  // drawers may offer.
  const unitTypeIds = input.offering
    ? []
    : selected(input.filters.unitTypeId, input.filters.unitTypeIds);

  let zoneIds: number[] | null =
    input.denominator.kind === "zones"
      ? input.denominator.zoneIds
      : // A rep subject constrained to one manager's zones carries both
        // predicates: the assignment is theirs *and* the clinic sits in that
        // manager's ground. They are ANDed, which is what makes a shared rep
        // read differently to each of their managers.
        (input.denominator.kind === "rep"
          ? (input.denominator.withinZoneIds ?? null)
          : null);
  let repUserIds: number[] | null =
    input.denominator.kind === "rep" ? [input.denominator.userId] : null;

  if (managerIds.length > 0) {
    // Several managers widen each other — their zones union — but the result is
    // still intersected with the viewer's own, so a filter can never reach past
    // the scope the viewer already had.
    const zoneLists = await Promise.all(
      managerIds.map((userId) =>
        input.directory.findManagerZoneIds({ userId, verticalId: input.verticalId }),
      ),
    );
    const filterZoneIds = [...new Set(zoneLists.flat())];
    zoneIds =
      zoneIds === null
        ? filterZoneIds
        : zoneIds.filter((id) => filterZoneIds.includes(id));
  }

  if (repIds.length > 0) {
    repUserIds =
      repUserIds === null
        ? repIds
        : repUserIds.filter((id) => repIds.includes(id));
    // A rep viewing their own dashboard, filtered to somebody else: the answer
    // is nothing, and saying nothing is correct.
    if (repUserIds.length === 0) return { empty: true };
  }

  if (zoneIds !== null && zoneIds.length === 0) {
    return { empty: true };
  }

  return {
    empty: false,
    filter: {
      verticalId: input.verticalId,
      zoneIds,
      repUserIds,
      stateIds: stateIds.length > 0 ? stateIds : null,
      municipalityIds: municipalityIds.length > 0 ? municipalityIds : null,
      unitTypeIds: unitTypeIds.length > 0 ? unitTypeIds : null,
    },
  };
}
