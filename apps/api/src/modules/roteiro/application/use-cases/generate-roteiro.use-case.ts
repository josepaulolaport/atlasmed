import type { ScopeContext } from "@atlasmed/access";
import {
  AppError,
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type {
  FixedPoint,
  RoteiroBucket,
  RoteiroCandidate,
  RoteiroParams,
  RoteiroPoint,
  RoteiroReachMode,
  RoteiroRepository,
} from "../interfaces/roteiro.repository.interface";

/**
 * Defaults used when a linha has no `roteiro_params` row.
 *
 * Deliberately a constant rather than a seed migration: these are commercial
 * judgements calibrated against a book that is 93.8 % prospects (spec 0016
 * §4.9), and they will be wrong once the funnel fills. A migration would freeze
 * today's answer and need superseding every time it moved — the same reasoning
 * that keeps `registry.professional_councils` out of a seed. Inserting a row
 * overrides these permanently; until someone does, the response says the
 * defaults were used.
 */
export const DEFAULT_ROTEIRO_PARAMS: Omit<RoteiroParams, "verticalId"> = {
  dailyLimit: 5,
  weights: { t: 0.16, h: 0.1, n: 0.12, v: 0.06, k: 0.07, c: 0.27, q: 0.22 },
  bucketRatios: { MANTER: 0.2, RECUPERAR: 0.2, PROSPECTAR: 0.6 },
  cooldownDays: { MANTER: 14, RECUPERAR: 21, PROSPECTAR: 30 },
  coverageHorizonDays: { MANTER: 90, RECUPERAR: 180, PROSPECTAR: 180 },
  serviceMinutes: {
    IN_PERSON: 60,
    // A guess, but a better-informed one than a single number. Maintaining an
    // account the rep already has is a short call-in; a first visit means
    // reception, a wait and an introduction to someone who has never met us,
    // and a recovery visit has to re-open a conversation that lapsed.
    //
    // All multiples of 30 because the calendar rounds up to its slot: the old
    // flat 45 was already living as a 60 in every rep's day.
    byBucket: { MANTER: 30, RECUPERAR: 60, PROSPECTAR: 60 },
  },
  unitTypePolicy: {
    "Clinica/Centro de Especialidade": { fit: 1.0, eligible: true },
    "Hospital/Dia - Isolado": { fit: 1.0, eligible: true },
    Policlinica: { fit: 0.55, eligible: true },
    "Consultorio Isolado": { fit: 0.35, eligible: true },
    "Hospital Especializado": { fit: 0.35, eligible: true },
    // Below what conversion alone justifies (3.5% vs a clinic's 9.6%), by
    // commercial decision: a hospital visit costs more of a rep's day in
    // access and gatekeeping, and purchasing is centralised and slower.
    "Hospital Geral": { fit: 0.15, eligible: true },
    "*": { fit: 0.05, eligible: true },
  },
  reachRadiusKm: 60,
  detourBudgetKm: 20,
  tauSeconds: 900,
  remoteThresholdSeconds: 2700,
  headroomUnknown: 0.4,
  // Same mid-band as headroom, for the same reason: not knowing is not a
  // reason to rank a clinic last. CNES may only ever raise confidence in a
  // clinic, never lower it — its absence means we have not looked, and not
  // having looked is a reason to visit.
  capacityUnknown: 0.4,
  workdayStart: "08:00",
  workdayEnd: "18:00",
  lunchStart: "12:00",
  lunchMinutes: 60,
  maxGenerationsPerDay: 20,
};

/**
 * The fallback when Mapbox cannot answer. Straight-line kilometres understate a
 * drive, so they are inflated by a circuity factor and divided by an assumed
 * speed.
 *
 * **Calibrated against real Matrix responses, 2026-08-15**, not guessed. A full
 * day generated for each of the five reps, estimated against real:
 *
 * | rep | estimated | real | ratio |
 * |---|---|---|---|
 * | Rio | 19 min | 30 min | 1.58 |
 * | São Paulo | 43 min | 55 min | 1.28 |
 * | Londrina | 9 min | 14 min | 1.56 |
 * | Brasília | 27 min | 26 min | **0.96** |
 * | São Luís | 17 min | 23 min | 1.35 |
 *
 * The original 28 km/h was optimistic by roughly a third. Speed drops to 22,
 * which centres the fallback on the observed median instead of sitting under
 * every city but one.
 *
 * Brasília being the outlier is not noise — its planned grid means straight
 * lines are nearly drivable, where Rio's hills and Londrina's layout are not.
 * **No single constant fits a country this varied**, which is the real argument
 * for the Matrix rather than a better guess. These numbers exist so the feature
 * still works with no signal, and every duration they produce is labelled
 * `estimado` on screen.
 */
const ROAD_CIRCUITY_FACTOR = 1.35;
const AVERAGE_SPEED_KMH = 22;

/**
 * Mapbox's `driving` profile accepts at most 25 coordinates in one matrix call
 * (`driving-traffic` allows only 10, which is why it is not used).
 *
 * One call per generation is the §7.4 budget, so when the shortlist plus the
 * day's fixed points exceed this the lowest-merit candidates are dropped from
 * the matrix and fall back to estimates. They are still selectable — they are
 * simply costed less precisely, which is the right thing to lose first.
 */
const MATRIX_MAX_COORDINATES = 25;

/**
 * The calendar stores durations in 30-minute steps and rejects anything else
 * (`validateEventData`: "durationMinutes must be a positive multiple of 30").
 *
 * So the roteiro plans in the same unit rather than rounding at confirm time.
 * Rounding later would hand the rep a plan saying 45 minutes and write 60 into
 * their calendar — precisely the silent shift §7.3 forbids, and they would only
 * discover it after approving. Snapping here means the times they approve are
 * the times that land.
 *
 * The cost is real and worth stating: a 45-minute visit reserves 60 and a
 * 15-minute call reserves 30, so a day holds slightly fewer stops than the raw
 * durations suggest. Relaxing the calendar's 30-minute rule is the alternative
 * and is a change to an invariant every other interaction already relies on.
 */
const CALENDAR_SLOT_MINUTES = 30;

/**
 * How long this clinic takes: what the rep said, else the bucket default, else
 * the flat fallback — snapped up to a calendar slot in one place so no caller
 * can plan a duration the calendar will silently change (§7.3).
 */
function serviceMsFor(
  candidate: { facilityVerticalProfileId: number; bucket: RoteiroBucket },
  params: RoteiroParams,
  overrides: Record<number, number>,
): number {
  const minutes =
    overrides[candidate.facilityVerticalProfileId] ??
    params.serviceMinutes.byBucket?.[candidate.bucket] ??
    params.serviceMinutes.IN_PERSON;
  return toCalendarSlot(minutes) * 60_000;
}

function toCalendarSlot(minutes: number): number {
  return Math.max(
    CALENDAR_SLOT_MINUTES,
    Math.ceil(minutes / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_MINUTES,
  );
}

/**
 * §15.5.3 — how much of a rep's shortlist must carry CNES staff data before we
 * trust capacity to be discriminating at all.
 *
 * Below this the registry is not merely thin, it has probably failed: the
 * capacity component still ranks (the unknown sit at a neutral mid-band rather
 * than at the bottom, so nothing is buried), but ops needs to know that a
 * quarter of the engine's weight is resting on data that did not arrive.
 */
const MIN_REGISTRY_COVERAGE = 0.6;

/** §4.1 — how far the bound may widen before we give up, and in what steps. */
const REACH_EXPANSION_STEPS = [1, 2, 4, 8] as const;
/** Shortlist depth, per §4.5. */
const SHORTLIST_FACTOR = 4;

/**
 * The agent's existing commitments for the day, as busy intervals.
 *
 * A port rather than a calendar import so generation stays unit-testable, and
 * backed by `GetCalendarAvailabilityUseCase` so recurring events expand the
 * same way they do everywhere else — a weekly block occurring today is busy
 * today, and re-deriving that here would be a second expansion to keep in sync.
 */
/**
 * Real driving times between points — spec 0016 §4.5 step 2.
 *
 * `null` means unavailable for any reason: no token, Mapbox down, too many
 * coordinates, a malformed response. The engine then falls back to the
 * haversine estimator and labels every duration `estimado` end to end (§4.8).
 * That is not a degraded corner case — it is the state a rep in a basement or
 * on a bad connection is actually in, and the feature has to keep working there.
 */
export interface TravelTimeSource {
  /**
   * A full duration matrix over `points`, in seconds. `matrix[i][j]` is the
   * drive from `points[i]` to `points[j]`.
   */
  durations(points: RoteiroPoint[]): Promise<number[][] | null>;
}

/**
 * How many generations an agent has left today — spec 0016 §7.4.
 *
 * A generation spends a paid Matrix call, and nothing else stops a rep pulling
 * to refresh through a morning. The ceiling is `max_generations_per_day` in
 * `roteiro_params`, so it moves without a deploy.
 */
export interface GenerationQuota {
  consume(input: { userId: number; day: string; max: number }): Promise<boolean>;
}

export interface ScheduleReader {
  execute(input: {
    actor: { userId: number; roleName: string };
    scope: ScopeContext;
    ownerUserId?: number;
    from: Date;
    to: Date;
  }): Promise<
    Array<{
      startsAt: string;
      endsAt: string;
      /** Present for an INTERACTION; absent for a personal block. */
      interaction?: { facilityId: number; modality?: "IN_PERSON" | "REMOTE" };
    }>
  >;
}

interface BusyInterval {
  startsAt: number;
  endsAt: number;
}

/**
 * A day other than today, with nothing booked to start from.
 *
 * Deliberately an error rather than a guess: §4.1's measured finding is that an
 * inferred origin lands in empty space, and a plan built from a position nobody
 * confirmed produces drive times that look exactly as trustworthy as real ones.
 */
export class RoteiroOriginRequiredError extends AppError {
  constructor(scopeDate: string) {
    super(
      "ROTEIRO_ORIGIN_REQUIRED",
      400,
      "Escolha de onde você começa o dia — não há visita agendada para partir.",
      { scopeDate },
    );
  }
}

/** The agent has regenerated too many times today (§7.4). */
export class RoteiroQuotaExceededError extends AppError {
  constructor(max: number) {
    super(
      "ROTEIRO_QUOTA_EXCEEDED",
      429,
      `Limite de ${max} gerações por dia atingido. Tente novamente amanhã.`,
      { max },
    );
  }
}

export interface RoteiroNotice {
  code: string;
  message: string;
  [detail: string]: unknown;
}

export interface GenerateRoteiroInput {
  actor: { userId: number; roleName: string };
  scope: ScopeContext;
  /** Whose day. Defaults to the actor; a manager may target a rep they manage. */
  subjectUserId?: number;
  verticalId: number;
  /**
   * Where the day starts.
   *
   * Optional now that a roteiro can plan a day other than today: live GPS
   * answers "where am I", which says nothing about tomorrow. When it is absent
   * the engine falls back to the day's first booked in-person visit, and when
   * the day has none it refuses rather than guessing (§15.4.1).
   */
  origin?: RoteiroPoint;
  limit?: number;
  /**
   * Clinics the rep took out of the slate. Excluded from the candidate set
   * entirely rather than filtered afterwards, so regenerating fills the freed
   * slot with the next best clinic instead of returning a shorter day.
   */
  excludeProfileIds?: number[];
  /**
   * Clinics the rep added by hand. Forced into the slate ahead of the merit
   * ranking — a rep who names a clinic has a reason the engine does not have.
   */
  includeProfileIds?: number[];
  /**
   * How long the rep says a particular clinic takes, keyed by profile id.
   *
   * Fed into planning rather than applied to the result, because duration is
   * not cosmetic: it is the denominator of the gain a stop is chosen on
   * (§4.5) and it decides what else fits the gap. A two-hour hospital the
   * engine believes is one hour does not just display wrong — it displaces a
   * clinic that would have fitted.
   */
  durationOverrides?: Record<number, number>;
  /**
   * Times the rep pinned a clinic to, keyed by profile id.
   *
   * A pinned stop stops being a suggestion and becomes a **commitment**: it is
   * fed in as a fixed point, exactly like a booked visit, so the gaps split
   * around it, reachability anchors on it and re-ordering cannot move it. That
   * is what the rep meant — they did not ask the engine to consider 14:00, they
   * said they will be there at 14:00.
   */
  startOverrides?: Record<number, Date>;
  /**
   * Persist the result as a DRAFT. `POST /roteiros` does; `/preview` does not,
   * so exploring anchors never disturbs the rep's live plan for the day.
   */
  persist?: boolean;
  today: string;
  now: Date;
  /** Defaults to `APP_TIME_ZONE`. The workday is the rep's, not the server's. */
  timeZone?: string;
}

/**
 * A stretch of the day the engine may plan into, bounded by whatever the rep is
 * already committed to at each end.
 *
 * The four situations a rep is actually in are one structure:
 *
 * | situation | `from` | `to` |
 * |---|---|---|
 * | free day | GPS | — |
 * | before the first booking | GPS | that booking |
 * | between two bookings | the earlier | the later |
 * | after the last booking | that booking | — |
 *
 * A gap with a `to` is **bounded at both ends**: anything placed in it has to
 * leave enough time to reach the next commitment, or the rep arrives late to
 * something they already promised. A gap without one runs to the end of the
 * working day and only has to fit going in.
 *
 * Modelling it this way is what stops a clinic that suits the afternoon leg
 * being scheduled into the morning — the failure of a single cursor walking
 * forward from the origin and pushing past obstacles.
 */
interface DayGap {
  index: number;
  from: RoteiroPoint;
  /** Null for the tail: nowhere to be afterwards. */
  to: RoteiroPoint | null;
  /** Where the next placement departs from — advances as stops are added. */
  cursor: RoteiroPoint;
  /** When the next placement can start — advances as stops are added. */
  clock: number;
  /** The gap's original start, kept so re-ordering can re-time from scratch. */
  clockStart: number;
  /** Hard end: the next commitment's start, or the close of the working day. */
  endsAt: number;
}

/**
 * A chosen clinic, already placed: selection decides *where in the day* a stop
 * goes at the same time as deciding whether to take it, so there is no second
 * scheduling pass to disagree with it.
 */
interface PlacedStop {
  candidate: RoteiroCandidate;
  isCoverageSlot: boolean;
  gapIndex: number;
  startsAt: Date;
  endsAt: Date;
  travelSeconds: number;
}

/** A clinic the rep put at a time, before it becomes a fixed point. */
interface PinnedStop {
  candidate: RoteiroCandidate;
  startsAt: Date;
  endsAt: Date;
}

interface PlannedStop {
  candidate: RoteiroCandidate;
  position: number;
  modality: "IN_PERSON" | "REMOTE";
  modalitySource: "SUGGESTED";
  isCoverageSlot: boolean;
  isAnchor: boolean;
  travelSecondsFromPrev: number | null;
  serviceMinutes: number;
  plannedStartsAt: Date;
  plannedEndsAt: Date;
}

/**
 * The application's civil timezone, matching spec 0013 §4.3. A rep's workday is
 * a fact about their day, never about the server's.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** How far `timeZone` is behind UTC at `at`, in milliseconds. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return at.getTime() - asUtc;
}

/**
 * The day split into plannable stretches by the rep's existing commitments.
 *
 * Personal blocks are not boundaries — they have no location, so they cannot
 * bound a leg. They stay in `busy` and are stepped over inside whichever gap
 * they fall in.
 */
function buildGaps(args: {
  origin: RoteiroPoint;
  fixedPoints: FixedPoint[];
  from: number;
  dayEnd: number;
}): DayGap[] {
  const gaps: DayGap[] = [];
  let cursorPoint = args.origin;
  let clock = args.from;

  for (const point of args.fixedPoints) {
    const endsAt = point.startsAt.getTime();
    if (endsAt > clock) {
      gaps.push({
        index: gaps.length,
        from: cursorPoint,
        to: { lat: point.lat, lng: point.lng },
        cursor: cursorPoint,
        clock,
        clockStart: clock,
        endsAt,
      });
    }
    cursorPoint = { lat: point.lat, lng: point.lng };
    clock = Math.max(clock, point.endsAt.getTime());
  }

  if (args.dayEnd > clock) {
    gaps.push({
      index: gaps.length,
      from: cursorPoint,
      to: null,
      cursor: cursorPoint,
      clock,
      clockStart: clock,
      endsAt: args.dayEnd,
    });
  }
  return gaps;
}

/**
 * Whether a candidate fits a gap, and what the detour costs.
 *
 * The cost is the **added** travel, not the total: going out to a clinic and
 * back onto the leg, minus the drive that was happening anyway. On the tail
 * there is no return, so it is simply the drive out — which is why a clinic
 * far along the last leg is cheap in the afternoon and expensive at 11:00
 * between two bookings.
 */
function fitInGap(
  gap: DayGap,
  point: RoteiroPoint,
  serviceMs: number,
  busy: BusyInterval[],
  travel: TravelFn,
): { startsAt: number; endsAt: number; travelSeconds: number; addedSeconds: number } | null {
  const inbound = travel(gap.cursor, point);
  const startsAt = pushPastBusy(gap.clock + inbound * 1000, serviceMs, busy);
  const endsAt = startsAt + serviceMs;

  const outbound = gap.to === null ? 0 : travel(point, gap.to);
  // Bounded gaps must still allow the rep to reach the next commitment.
  if (endsAt + outbound * 1000 > gap.endsAt) return null;

  const direct = gap.to === null ? 0 : travel(gap.cursor, gap.to);
  return {
    startsAt,
    endsAt,
    travelSeconds: inbound,
    addedSeconds: Math.max(0, inbound + outbound - direct),
  };
}

/**
 * The best visiting order for the stops chosen into one gap.
 *
 * Greedy selection picks by merit-per-detour one stop at a time and never
 * reconsiders, which is myopic: measured on a clear day it lands exactly on the
 * optimal route for two reps and up to **55 % above it** for another — 5 km of
 * driving bought nothing. §4.5 step 5 asked for a 2-opt pass; at these sizes an
 * exact search is cheaper to reason about and strictly better.
 *
 * Reordering happens **within a gap only**. A stop cannot cross a booking: the
 * commitments at each end are fixed in time, so moving a suggestion past one
 * would put the rep in two places at once.
 *
 * `to` is included in the cost when the gap is bounded, because the drive onto
 * the next commitment is part of what the ordering pays for. Falls back to the
 * given order beyond `MAX_EXACT_ORDER` stops, which no daily limit reaches.
 */
const MAX_EXACT_ORDER = 7;

function bestOrder<T extends { lat: number; lng: number }>(
  from: RoteiroPoint,
  to: RoteiroPoint | null,
  stops: T[],
  travel: TravelFn,
): T[] {
  if (stops.length < 2 || stops.length > MAX_EXACT_ORDER) return stops;

  const cost = (order: T[]): number => {
    let total = 0;
    let cursor: RoteiroPoint = from;
    for (const stop of order) {
      total += travel(cursor, stop);
      cursor = stop;
    }
    if (to) total += travel(cursor, to);
    return total;
  };

  let best = stops;
  let bestCost = cost(stops);
  const permute = (remaining: T[], acc: T[]): void => {
    if (remaining.length === 0) {
      const candidate = cost(acc);
      if (candidate < bestCost) {
        bestCost = candidate;
        best = acc;
      }
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      permute([...remaining.slice(0, i), ...remaining.slice(i + 1)], [...acc, remaining[i]!]);
    }
  };
  permute(stops, []);
  return best;
}

/** The first start at or after `from` where a `duration` fits between blocks. */
function pushPastBusy(from: number, duration: number, busy: BusyInterval[]): number {
  let candidate = from;
  // Blocks are sorted, but clearing one can push into a later one, so keep
  // sweeping until a pass changes nothing.
  for (let guard = 0; guard < busy.length + 1; guard += 1) {
    const clash = busy.find(
      (block) => candidate < block.endsAt && candidate + duration > block.startsAt,
    );
    if (!clash) return candidate;
    candidate = clash.endsAt;
  }
  return candidate;
}

function haversineKm(a: RoteiroPoint, b: RoteiroPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function estimatedTravelSeconds(from: RoteiroPoint, to: RoteiroPoint): number {
  const km = haversineKm(from, to) * ROAD_CIRCUITY_FACTOR;
  return Math.round((km / AVERAGE_SPEED_KMH) * 3600);
}

/** How the engine asks for a drive time. Swapped, not branched on, at the top. */
type TravelFn = (from: RoteiroPoint, to: RoteiroPoint) => number;

/**
 * A lookup over a Mapbox duration matrix, falling back per pair.
 *
 * Per *pair*, deliberately: a point that did not make it into the matrix still
 * gets a usable number instead of poisoning the whole plan. Keyed on rounded
 * coordinates because the same clinic arrives from several code paths and
 * floating-point identity is not reliable across them.
 */
function matrixTravelFn(points: RoteiroPoint[], durations: number[][]): TravelFn {
  const key = (p: RoteiroPoint) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const index = new Map(points.map((p, i) => [key(p), i]));
  return (from, to) => {
    const i = index.get(key(from));
    const j = index.get(key(to));
    const value = i === undefined || j === undefined ? undefined : durations[i]?.[j];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : estimatedTravelSeconds(from, to);
  };
}

/** `slots_bucket = max(1, round(N × ratio))`, remainder to PROSPECTAR (§4.3). */
export function bucketQuotas(limit: number, ratios: Record<RoteiroBucket, number>) {
  const order: RoteiroBucket[] = ["PROSPECTAR", "MANTER", "RECUPERAR"];
  const quotas: Record<RoteiroBucket, number> = { MANTER: 0, RECUPERAR: 0, PROSPECTAR: 0 };
  let assigned = 0;
  for (const bucket of order) {
    const slots = Math.max(1, Math.round(limit * (ratios[bucket] ?? 0)));
    quotas[bucket] = slots;
    assigned += slots;
  }
  // Rounding can overshoot; trim from the largest, never below one slot each.
  while (assigned > limit) {
    const biggest = order.reduce((a, b) => (quotas[a] >= quotas[b] ? a : b));
    if (quotas[biggest] <= 1) break;
    quotas[biggest] -= 1;
    assigned -= 1;
  }
  return quotas;
}

export class GenerateRoteiroUseCase {
  constructor(
    private readonly deps: {
      repository: RoteiroRepository;
      schedule?: ScheduleReader;
      travel?: TravelTimeSource;
      quota?: GenerationQuota;
    },
  ) {}

  async execute(input: GenerateRoteiroInput) {
    const subjectUserId = input.subjectUserId ?? input.actor.userId;
    this.assertMayPlanFor(input, subjectUserId);

    const stored = await this.deps.repository.findParams(input.verticalId);
    const params: RoteiroParams = stored ?? {
      verticalId: input.verticalId,
      ...DEFAULT_ROTEIRO_PARAMS,
    };
    const notices: RoteiroNotice[] = [];
    /*
     * Deliberately not a notice. That the linha has no saved configuration is
     * true, unchanging and completely outside a rep's control — showing it on
     * every generation trains them to ignore the notice area, which is where
     * the things they *can* act on appear. It belongs in ops tooling, not on
     * the screen where someone is planning their morning.
     */
    const usingDefaultParams = !stored;

    const limit = Math.min(input.limit ?? params.dailyLimit, params.dailyLimit);
    if (limit < 1) {
      throw new ValidationError([{ field: "limit", message: "limit must be at least 1" }]);
    }

    // Counted before any work: the point is to stop the Matrix call, and a
    // check after it would have already spent the thing it protects.
    if (this.deps.quota) {
      const allowed = await this.deps.quota.consume({
        userId: subjectUserId,
        day: input.today,
        max: params.maxGenerationsPerDay,
      });
      if (!allowed) throw new RoteiroQuotaExceededError(params.maxGenerationsPerDay);
    }

    const assigned = await this.deps.repository.countAssignedProfiles({
      userId: subjectUserId,
      verticalId: input.verticalId,
    });
    if (assigned === 0) {
      throw new ResourceNotFoundError("Clínicas atribuídas nesta linha", subjectUserId);
    }

    const timeZone = input.timeZone ?? APP_TIME_ZONE;
    const { fixedPoints, busy } = await this.loadSchedule(
      input,
      subjectUserId,
      timeZone,
      params,
      notices,
    );
    // The mode is derived, never asked for: a day with bookings is planned
    // around them, a clear day is a plain circle around the rep.
    const reachMode: RoteiroReachMode = fixedPoints.length > 0 ? "ANCORA" : "LIVRE";

    /**
     * The day's starting point: what the rep sent, or where their first booked
     * visit is. Resolved here rather than at the edge because only the schedule
     * knows the fallback, and only the schedule has been read by this point.
     */
    const origin: RoteiroPoint =
      input.origin ??
      (fixedPoints[0] === undefined
        ? (() => {
            throw new RoteiroOriginRequiredError(input.today);
          })()
        : { lat: fixedPoints[0].lat, lng: fixedPoints[0].lng });

    const { candidates, reachBoundKm, expanded } = await this.reach({
      input,
      subjectUserId,
      params,
      reachMode,
      fixedPoints,
      origin,
      limit,
    });

    if (expanded) {
      notices.push({
        code: "REACH_EXPANDED",
        message: `Poucas clínicas por perto — a busca foi ampliada para ${reachBoundKm} km.`,
        reachBoundKm,
      });
    }

    if (candidates.length === 0) {
      notices.push({
        code: "NO_CANDIDATES",
        message:
          "Nenhuma clínica elegível ao alcance. Verifique a linha selecionada e sua localização.",
        reachBoundKm,
      });
    }

    /**
     * §15.5.3 — CNES is an extra, and a missing extra has to be visible.
     *
     * A registry load that half-failed does not announce itself. Capacity
     * already degrades gracefully (an unknown facility scores the neutral
     * mid-band, not zero), so this notice is not protecting the ranking — it is
     * telling whoever reads it that the ranking is running on less than it
     * looks like it is.
     */
    const registryCoverage =
      candidates.length === 0
        ? null
        : Number((candidates.filter((c) => c.registryKnown).length / candidates.length).toFixed(3));

    /**
     * Clinics the rep pinned to a time, promoted to commitments.
     *
     * Done here rather than inside selection because a pinned stop is not a
     * choice the engine gets to make. Once it is a fixed point every other part
     * of the day — the gaps, the anchoring, the ordering — treats it the way it
     * treats a booked visit, and none of them can quietly move it.
     *
     * After reachability on purpose: the shortlist is already drawn, and a pin
     * should not narrow the search that produced the clinic being pinned.
     */
    const pinned: PinnedStop[] = [];
    for (const [key, startsAt] of Object.entries(input.startOverrides ?? {})) {
      const profileId = Number(key);
      const candidate = candidates.find((c) => c.facilityVerticalProfileId === profileId);
      if (!candidate) {
        notices.push({
          code: "PINNED_NOT_AVAILABLE",
          facilityVerticalProfileId: profileId,
          message: "Uma clínica com horário fixado saiu da sua carteira e foi removida do dia.",
        });
        continue;
      }
      const serviceMs = serviceMsFor(candidate, params, input.durationOverrides ?? {});
      pinned.push({ candidate, startsAt, endsAt: new Date(startsAt.getTime() + serviceMs) });
    }
    for (const pin of pinned) {
      fixedPoints.push({
        facilityVerticalProfileId: pin.candidate.facilityVerticalProfileId,
        facilityId: pin.candidate.facilityId,
        facilityName: pin.candidate.facilityName,
        lat: pin.candidate.lat,
        lng: pin.candidate.lng,
        startsAt: pin.startsAt,
        endsAt: pin.endsAt,
      });
      busy.push({ startsAt: pin.startsAt.getTime(), endsAt: pin.endsAt.getTime() });
    }
    if (pinned.length > 0) {
      fixedPoints.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      busy.sort((a, b) => a.startsAt - b.startsAt);
    }
    const pinnedIds = new Set(pinned.map((p) => p.candidate.facilityVerticalProfileId));

    const dayEnd = this.atLocalTime(input.today, params.workdayEnd, timeZone);
    const gaps = buildGaps({
      origin,
      fixedPoints,
      from: Math.max(input.now.getTime(), this.atLocalTime(input.today, params.workdayStart, timeZone).getTime()),
      dayEnd: dayEnd.getTime(),
    });

    /**
     * One Matrix call per generation (§7.4), covering everything the cost model
     * will ask about: where the rep is, every commitment they already have, and
     * the shortlist.
     *
     * Placed here rather than inside selection because the same pair is costed
     * many times — once per gap per candidate during selection, again during
     * ordering — and asking Mapbox each time would be both slow and expensive.
     */
    const { travel, travelSource } = await this.resolveTravel(
      origin,
      fixedPoints,
      candidates,
      notices,
    );

    const selected = this.reorder(
      this.select({
        // A pinned clinic is already in the day. Leaving it selectable would
        // put it there twice.
        candidates: candidates.filter(
          (c) => !pinnedIds.has(c.facilityVerticalProfileId),
        ),
        limit: Math.max(0, limit - pinned.length),
        params,
        notices,
        gaps,
        busy,
        travel,
        includeProfileIds: input.includeProfileIds ?? [],
        durationOverrides: input.durationOverrides ?? {},
      }),
      gaps,
      params,
      busy,
      travel,
      input.durationOverrides ?? {},
    );

    // Selection placed every stop inside a gap, so ordering is just time order
    // and there is no second pass that could disagree with it.
    const stops: PlannedStop[] = [
      ...selected,
      ...pinned.map((pin) => ({
        candidate: pin.candidate,
        isCoverageSlot: false,
        gapIndex: -1,
        startsAt: pin.startsAt,
        endsAt: pin.endsAt,
        // The rep chose the time, so the drive to it is whatever it is —
        // claiming a travel leg the route never planned would be a number we
        // made up.
        travelSeconds: 0,
      })),
    ]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((placed, position) => {
        return {
          candidate: placed.candidate,
          position,
          // Every suggestion is a visit. Roteirização plans driving; a call is
          // something the rep arranges themselves, and the engine's only
          // interest in one is the time it occupies (§4.4).
          modality: "IN_PERSON" as const,
          modalitySource: "SUGGESTED" as const,
          isCoverageSlot: placed.isCoverageSlot,
          // A pinned stop is the rep's commitment, and the card says so.
          isAnchor: placed.gapIndex === -1,
          // Null, not zero: the route never planned a leg to a stop the rep
          // placed by hand, and "0 min de deslocamento" would be a claim.
          travelSecondsFromPrev: placed.gapIndex === -1 ? null : placed.travelSeconds,
          serviceMinutes: Math.round(
            (placed.endsAt.getTime() - placed.startsAt.getTime()) / 60_000,
          ),
          plannedStartsAt: placed.startsAt,
          plannedEndsAt: placed.endsAt,
        };
      });

    /**
     * §4.5 step 6 — the day has an end, and a stop past it is not a plan.
     *
     * Dropped from the tail rather than compressed: the alternative is
     * shortening visits or overlapping them, which produces a schedule the rep
     * cannot actually keep. Reported, because a slate that quietly returns three
     * stops when five were asked for looks like a thin territory rather than a
     * full day.
     */
    if (stops.length < limit && candidates.length > stops.length) {
      notices.push({
        code: "DAY_FULL",
        requested: limit,
        scheduled: stops.length,
        message:
          stops.length === 0
            ? "Seu dia já está cheio — não há espaço para novas visitas hoje."
            : `Couberam ${stops.length} de ${limit} sugestões nos intervalos livres do seu dia.`,
      });
    }

    const persisted = input.persist
      ? await this.deps.repository.createDraft({
          userId: subjectUserId,
          createdByUserId: input.actor.userId,
          verticalId: input.verticalId,
          scopeDate: input.today,
          origin,
          reachMode,
          anchorProfileId: fixedPoints[0]?.facilityVerticalProfileId ?? null,
          reachBoundKm,
          travelSource,
          paramsSnapshot: params as unknown as Record<string, unknown>,
          notices: notices as unknown[],
          stops: stops.map((stop) => ({
            position: stop.position,
            facilityVerticalProfileId: stop.candidate.facilityVerticalProfileId,
            facilityId: stop.candidate.facilityId,
            bucket: stop.candidate.bucket,
            modality: stop.modality,
            serviceMinutes: stop.serviceMinutes,
            travelSecondsFromPrev: stop.travelSecondsFromPrev,
            plannedStartsAt: stop.plannedStartsAt,
            plannedEndsAt: stop.plannedEndsAt,
            isCoverageSlot: stop.isCoverageSlot,
            source: stop.isAnchor ? ("ANCHOR" as const) : ("SUGGESTED" as const),
            meritScore: stop.candidate.meritScore,
            scoreBreakdown: stop.candidate.components,
          })),
        })
      : null;

    return {
      id: persisted?.id ?? null,
      status: persisted?.status ?? null,
      subjectUserId,
      verticalId: input.verticalId,
      scopeDate: input.today,
      origin,
      reachMode,
      anchorProfileId: fixedPoints[0]?.facilityVerticalProfileId ?? null,
      // Coordinates included: the timeline and the P2 map both have to draw
      // the day as one sequence, and a booked visit is part of that sequence.
      // Pinned clinics are fixed points to the engine but suggestions to the
      // rep — they are in `stops`, and echoing them here too would draw each
      // one twice.
      fixedPoints: fixedPoints
        .filter(
          (point) =>
            point.facilityVerticalProfileId === null ||
            !pinnedIds.has(point.facilityVerticalProfileId),
        )
        .map((point) => ({
        facilityId: point.facilityId,
        facilityName: point.facilityName,
        lat: point.lat,
        lng: point.lng,
        startsAt: point.startsAt,
        endsAt: point.endsAt,
      })),
      reachBoundKm,
      travelSource,
      // The day's capacity, not what was filled. The client draws the shortfall
      // as empty slots, which is how a rep sees there is room left.
      slotCount: limit,
      params,
      usingDefaultParams,
      // §15.5.3 — what share of the shortlist CNES actually knows anything
      // about. Below MIN_REGISTRY_COVERAGE the registry has probably failed
      // rather than merely being thin.
      registryCoverage,
      registryCoverageLow:
        registryCoverage !== null && registryCoverage < MIN_REGISTRY_COVERAGE,
      notices,
      stops,
      totals: {
        stops: stops.length,
        driveSeconds: stops.reduce((sum, s) => sum + (s.travelSecondsFromPrev ?? 0), 0),
        serviceMinutes: stops.reduce((sum, s) => sum + s.serviceMinutes, 0),
        endsAt: stops.at(-1)?.plannedEndsAt ?? null,
      },
    };
  }

  /**
   * A manager may draft for a rep they manage; nobody else may plan another
   * person's day. Confirming is a separate, stricter gate (§7.3) — writing to
   * someone's calendar stays theirs alone.
   */
  private assertMayPlanFor(input: GenerateRoteiroInput, subjectUserId: number): void {
    if (subjectUserId === input.actor.userId) return;
    if (input.actor.roleName === "ADMIN" && input.scope.isGlobal) return;
    if (input.actor.roleName === "MANAGER" && input.scope.managedUserIds.includes(subjectUserId)) {
      return;
    }
    throw new ForbiddenError("Roteiro is outside the current owner/team scope");
  }

  /**
   * The agent's day as it already stands — **read, never asked for**.
   *
   * A rep who has four visits booked should not have to tell the app about
   * them; it made those bookings. So the schedule is derived and split in two:
   *
   *   - booked **interactions** become `FixedPoint`s. They pin both the clock
   *     and the map: the engine plans into the gaps between them and treats
   *     their locations as places the rep is already driving to, which is what
   *     makes "what else is on the way" answerable.
   *   - personal blocks become plain busy time. There is nowhere to be.
   *
   * Skipping this produces a plan that **cannot be confirmed** — §7.3 refuses
   * to shift a rep's times, so any stop overlapping something booked returns a
   * 409. A slate that fails at acceptance is worse than a shorter one.
   */
  private async loadSchedule(
    input: GenerateRoteiroInput,
    subjectUserId: number,
    timeZone: string,
    params: RoteiroParams,
    notices: RoteiroNotice[],
  ): Promise<{ fixedPoints: FixedPoint[]; busy: BusyInterval[] }> {
    const dayStart = this.atLocalTime(input.today, params.workdayStart, timeZone);
    const dayEnd = this.atLocalTime(input.today, params.workdayEnd, timeZone);
    const busy: BusyInterval[] = [];
    const fixedPoints: FixedPoint[] = [];

    if (this.deps.schedule) {
      const occurrences = await this.deps.schedule.execute({
        actor: input.actor,
        scope: input.scope,
        ownerUserId: subjectUserId,
        from: dayStart,
        to: dayEnd,
      });

      const facilityIds = [
        ...new Set(
          occurrences
            .filter((o) => o.interaction?.modality !== "REMOTE")
            .map((o) => o.interaction?.facilityId)
            .filter((id): id is number => typeof id === "number"),
        ),
      ];
      const located = await this.deps.repository.locateFacilities({
        facilityIds,
        verticalId: input.verticalId,
      });
      const byFacility = new Map(located.map((row) => [row.facilityId, row]));

      for (const occurrence of occurrences) {
        const startsAt = new Date(occurrence.startsAt);
        const endsAt = new Date(occurrence.endsAt);
        busy.push({ startsAt: startsAt.getTime(), endsAt: endsAt.getTime() });

        const facilityId = occurrence.interaction?.facilityId;
        /**
         * **A booked phone call is not somewhere to be.**
         *
         * Only an `IN_PERSON` interaction anchors the route. A `REMOTE` one
         * blocks the clock — the rep is on a call and cannot be selling
         * elsewhere — but they can take it from anywhere, so treating it as a
         * fixed point is wrong twice: it drags the reachable set toward a
         * clinic nobody is driving to, and it reserves travel either side of a
         * journey that does not happen.
         *
         * Same for a visit at a facility with no coordinates: real, but not
         * placeable.
         */
        const isRemote = occurrence.interaction?.modality === "REMOTE";
        const place =
          facilityId === undefined || isRemote ? undefined : byFacility.get(facilityId);
        if (place) {
          fixedPoints.push({
            facilityVerticalProfileId: place.facilityVerticalProfileId,
            facilityId: place.facilityId,
            facilityName: place.facilityName,
            lat: place.lat,
            lng: place.lng,
            startsAt,
            endsAt,
          });
        }
      }

      fixedPoints.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      if (occurrences.length > 0) {
        notices.push({
          code: "EXISTING_COMMITMENTS",
          count: occurrences.length,
          routed: fixedPoints.length,
          message:
            fixedPoints.length > 0
              ? `Você já tem ${occurrences.length} ${occurrences.length === 1 ? "compromisso" : "compromissos"} hoje — as sugestões estão no caminho deles.`
              : `Você já tem ${occurrences.length} ${occurrences.length === 1 ? "compromisso" : "compromissos"} hoje — o roteiro foi planejado ao redor deles.`,
        });
      }
    }

    const lunchStart = this.atLocalTime(input.today, params.lunchStart, timeZone);
    busy.push({
      startsAt: lunchStart.getTime(),
      endsAt: lunchStart.getTime() + params.lunchMinutes * 60_000,
    });

    return { fixedPoints, busy: busy.sort((a, b) => a.startsAt - b.startsAt) };
  }

  /** §4.1 — widen the bound until the shortlist is deep enough, or give up. */
  private async reach(args: {
    input: GenerateRoteiroInput;
    subjectUserId: number;
    params: RoteiroParams;
    reachMode: RoteiroReachMode;
    fixedPoints: FixedPoint[];
    origin: RoteiroPoint;
    limit: number;
  }) {
    const base =
      args.reachMode === "ANCORA" ? args.params.detourBudgetKm : args.params.reachRadiusKm;
    const wanted = args.limit * SHORTLIST_FACTOR;
    let candidates: RoteiroCandidate[] = [];
    let reachBoundKm = base;

    for (const [index, step] of REACH_EXPANSION_STEPS.entries()) {
      reachBoundKm = base * step;
      candidates = await this.deps.repository.scoreCandidates({
        userId: args.subjectUserId,
        verticalId: args.input.verticalId,
        origin: args.origin,
        reachMode: args.reachMode,
        fixedPoints: args.fixedPoints,
        excludeProfileIds: args.input.excludeProfileIds ?? [],
        // Pinned clinics ride the same union: they have to be in the shortlist
        // for the engine to know where they are, and a pinned clinic is exactly
        // as likely as a requested one to be low-merit — which is why the rep
        // had to say so.
        includeProfileIds: [
          ...(args.input.includeProfileIds ?? []),
          ...Object.keys(args.input.startOverrides ?? {}).map(Number),
        ],
        reachBoundKm,
        params: args.params,
        today: args.input.today,
        limit: wanted,
      });
      if (candidates.length >= wanted || index === REACH_EXPANSION_STEPS.length - 1) break;
    }

    return { candidates, reachBoundKm, expanded: reachBoundKm !== base };
  }

  /**
   * §4.3 quotas plus the §4.3.1 coverage slot.
   *
   * Quotas are targets, not floors: an unfillable bucket spills to the next by
   * merit **and says so**. A slate silently missing its prospecting stop looks
   * identical to one where prospecting was impossible, and only one of those is
   * a problem worth acting on.
   */
  private select(args: {
    candidates: RoteiroCandidate[];
    limit: number;
    params: RoteiroParams;
    notices: RoteiroNotice[];
    gaps: DayGap[];
    busy: BusyInterval[];
    travel: TravelFn;
    includeProfileIds: number[];
    durationOverrides: Record<number, number>;
  }) {
    const { candidates, limit, params, notices, gaps, busy, travel, includeProfileIds, durationOverrides } =
      args;
    const quotas = bucketQuotas(limit, params.bucketRatios);
    const taken = new Set<number>();
    const chosen: PlacedStop[] = [];

    // Booked visits are deliberately **not** selected here. They are already in
    // the rep's calendar; the engine plans around them rather than proposing
    // them back. They shape the route through §4.1 reachability and the §4.5
    // cost model, not through the slate.

    /**
     * Clinics the rep asked for, placed before anything the engine chose.
     *
     * A rep naming a clinic knows something the engine does not — a call they
     * took, a doctor expecting them. So it goes in on their say-so, not on
     * merit, and only fails if the day genuinely cannot hold it.
     */
    for (const profileId of includeProfileIds) {
      if (chosen.length >= limit) break;
      const wanted = candidates.find((c) => c.facilityVerticalProfileId === profileId);
      if (!wanted || taken.has(profileId)) continue;
      const serviceMs = serviceMsFor(wanted, params, durationOverrides);
      let placed: { gap: DayGap; at: NonNullable<ReturnType<typeof fitInGap>> } | null = null;
      for (const gap of gaps) {
        const at = fitInGap(gap, { lat: wanted.lat, lng: wanted.lng }, serviceMs, busy, travel);
        if (at && (!placed || at.addedSeconds < placed.at.addedSeconds)) placed = { gap, at };
      }
      if (!placed) {
        notices.push({
          code: "REQUESTED_DOES_NOT_FIT",
          facilityVerticalProfileId: profileId,
          message: `${wanted.facilityName} não cabe no dia — remova outra parada para incluí-la.`,
        });
        continue;
      }
      taken.add(profileId);
      chosen.push({
        candidate: wanted,
        isCoverageSlot: false,
        gapIndex: placed.gap.index,
        startsAt: new Date(placed.at.startsAt),
        endsAt: new Date(placed.at.endsAt),
        travelSeconds: placed.at.travelSeconds,
      });
      quotas[wanted.bucket] = Math.max(0, quotas[wanted.bucket] - 1);
      placed.gap.cursor = { lat: wanted.lat, lng: wanted.lng };
      placed.gap.clock = placed.at.endsAt;
    }

    // §4.3.1 — one reserved slot for the clinic longest without a commitment.
    const coverage = candidates
      .filter((c) => !taken.has(c.facilityVerticalProfileId) && c.coverageOverdue)
      .sort((a, b) => {
        const at = a.lastSuggestedAt?.getTime() ?? -Infinity;
        const bt = b.lastSuggestedAt?.getTime() ?? -Infinity;
        if (at !== bt) return at - bt;
        // Everything never covered ties at -Infinity above — today that is the
        // whole book — so the older assignment wins before merit does.
        const aa = a.assignmentStartedAt?.getTime() ?? Infinity;
        const ba = b.assignmentStartedAt?.getTime() ?? Infinity;
        if (aa !== ba) return aa - ba;
        return b.meritScore - a.meritScore;
      })[0];
    if (coverage && chosen.length < limit) {
      const serviceMs = serviceMsFor(coverage, params, durationOverrides);
      // The reserved slot still has to fit somewhere real. If the day cannot
      // hold it, it is not taken — a coverage stop the rep cannot make is not
      // coverage.
      let placed: { gap: DayGap; at: NonNullable<ReturnType<typeof fitInGap>> } | null = null;
      for (const gap of gaps) {
        const at = fitInGap(gap, { lat: coverage.lat, lng: coverage.lng }, serviceMs, busy, travel);
        if (at && (!placed || at.addedSeconds < placed.at.addedSeconds)) placed = { gap, at };
      }
      if (placed) {
        taken.add(coverage.facilityVerticalProfileId);
        chosen.push({
          candidate: coverage,
          isCoverageSlot: true,
          gapIndex: placed.gap.index,
          startsAt: new Date(placed.at.startsAt),
          endsAt: new Date(placed.at.endsAt),
          travelSeconds: placed.at.travelSeconds,
        });
        quotas[coverage.bucket] = Math.max(0, quotas[coverage.bucket] - 1);
        placed.gap.cursor = { lat: coverage.lat, lng: coverage.lng };
        placed.gap.clock = placed.at.endsAt;
      }
    }

    /**
     * §4.5 — greedy selection by **merit per hour**, not merit.
     *
     * Picking the top N by score and only then ordering them produces a
     * defensible-looking day that wastes an hour: measured against the real
     * book, rep 4's slate was four clinics inside 2 km plus one at 41 km, which
     * alone cost ~80 minutes of the day. Every one of those five was a good
     * clinic; the fifth was not a good *fifth* clinic.
     *
     *     gain = mérito × quotaMultiplier ÷ (added travel + service + τ)
     *
     * τ (900 s) stops the ratio exploding at zero distance and sets how much
     * detour a point of merit is worth. Candidates are appended to the route as
     * they are chosen, so selection and ordering are the same decision — which
     * is the honest shape of the problem.
     *
     * P1 costs the detour with the haversine estimator. This needs *a* cost
     * model, not Mapbox specifically; P2 swaps in the Matrix and nothing else
     * here changes.
     */
    const tau = params.tauSeconds;
    const remainingQuota = { ...quotas };

    /**
     * §4.5, applied per gap — pick the best (clinic, gap) pair, not the best
     * clinic.
     *
     *     gain = mérito × quotaMultiplier ÷ (added travel + service + τ)
     *
     * "Added travel" is the detour the clinic costs *that stretch of the day*:
     * out to it and back onto the leg, minus the drive already happening. So a
     * clinic far down the last leg is cheap after the final booking and
     * expensive squeezed between two morning ones, which is the distinction a
     * single forward-walking cursor could not make.
     *
     * A candidate that fits no gap is simply not chosen. That is how "his day
     * is already full" and "there is nothing near his 11:00 slot" become the
     * same, correctly-handled answer.
     */
    while (chosen.length < limit) {
      let best:
        | { candidate: RoteiroCandidate; gap: DayGap; placement: NonNullable<ReturnType<typeof fitInGap>>; gain: number }
        | null = null;

      for (const candidate of candidates) {
        if (taken.has(candidate.facilityVerticalProfileId)) continue;
        const serviceMs = serviceMsFor(candidate, params, durationOverrides);
        const point = { lat: candidate.lat, lng: candidate.lng };

        for (const gap of gaps) {
          const placement = fitInGap(gap, point, serviceMs, busy, travel);
          if (!placement) continue;
          const quotaMultiplier = (remainingQuota[candidate.bucket] ?? 0) > 0 ? 1 : 0.35;
          const cost = placement.addedSeconds + serviceMs / 1000;
          const gain = (candidate.meritScore * quotaMultiplier) / (cost + tau);
          if (!best || gain > best.gain) best = { candidate, gap, placement, gain };
        }
      }

      if (!best) break;
      taken.add(best.candidate.facilityVerticalProfileId);
      chosen.push({
        candidate: best.candidate,
        isCoverageSlot: false,
        gapIndex: best.gap.index,
        startsAt: new Date(best.placement.startsAt),
        endsAt: new Date(best.placement.endsAt),
        travelSeconds: best.placement.travelSeconds,
      });
      remainingQuota[best.candidate.bucket] = Math.max(
        0,
        (remainingQuota[best.candidate.bucket] ?? 0) - 1,
      );
      best.gap.cursor = { lat: best.candidate.lat, lng: best.candidate.lng };
      best.gap.clock = best.placement.endsAt;
    }

    /*
     * A quota only went *unfilled* if the bucket had nothing to offer.
     *
     * When the day itself ran out of room every bucket looks short, and saying
     * "no eligible clinic within reach" is then simply false — measured against
     * a real book it fired while 126 reachable prospects sat in the candidate
     * set. `DAY_FULL` is the true explanation in that case and this one
     * contradicts it, so it is only raised when the bucket is genuinely empty.
     */
    for (const bucket of ["PROSPECTAR", "MANTER", "RECUPERAR"] as RoteiroBucket[]) {
      const filled = chosen.filter((c) => c.candidate.bucket === bucket).length;
      if (filled >= quotas[bucket]) continue;
      const available = candidates.filter((c) => c.bucket === bucket).length;
      if (available > filled) continue;
      notices.push({
        code: "QUOTA_UNFILLED",
        bucket,
        requested: quotas[bucket],
        filled,
        message:
          bucket === "PROSPECTAR"
            ? "Nenhuma clínica sem compras elegível ao alcance — as vagas foram para outros baldes."
            : `Sem clínicas suficientes no balde ${bucket} — as vagas foram redistribuídas.`,
      });
    }

    return chosen;
  }

  /**
   * Real drive times where Mapbox can supply them, estimates everywhere else.
   *
   * Never throws. A generation that fails because a third-party API is
   * unreachable is worse than one carrying honest estimates — the rep is
   * usually in a car, which is exactly where the connection is worst.
   */
  private async resolveTravel(
    origin: RoteiroPoint,
    fixedPoints: FixedPoint[],
    candidates: RoteiroCandidate[],
    notices: RoteiroNotice[],
  ): Promise<{ travel: TravelFn; travelSource: "MAPBOX" | "ESTIMATED" }> {
    if (!this.deps.travel) return { travel: estimatedTravelSeconds, travelSource: "ESTIMATED" };

    // The rep and their commitments first: those pairs are costed on every
    // candidate, so they are the last thing that should be dropped to the cap.
    const points: RoteiroPoint[] = [
      origin,
      ...fixedPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...candidates.map((c) => ({ lat: c.lat, lng: c.lng })),
    ].slice(0, MATRIX_MAX_COORDINATES);

    try {
      const durations = await this.deps.travel.durations(points);
      if (!durations) {
        notices.push({
          code: "TRAVEL_ESTIMATED",
          message: "Tempos de deslocamento estimados — rota real indisponível agora.",
        });
        return { travel: estimatedTravelSeconds, travelSource: "ESTIMATED" };
      }
      return { travel: matrixTravelFn(points, durations), travelSource: "MAPBOX" };
    } catch {
      // Deliberately swallowed and reported rather than propagated: see above.
      notices.push({
        code: "TRAVEL_ESTIMATED",
        message: "Tempos de deslocamento estimados — rota real indisponível agora.",
      });
      return { travel: estimatedTravelSeconds, travelSource: "ESTIMATED" };
    }
  }

  /**
   * Re-orders each gap's stops onto the shortest route through it, then
   * re-times them.
   *
   * Greedy selection answers "is this clinic worth the detour *right now*",
   * which is the right question for choosing and the wrong one for sequencing —
   * it commits to an order before it knows what else is coming. Measured on a
   * clear day, that costs nothing for two reps and 55 % for another.
   *
   * Re-timing is not optional: moving a stop changes the drive to it, so the
   * clock has to be rebuilt or the plan would show times its own route
   * contradicts. Anything that no longer fits after reordering is dropped —
   * only possible if the shorter route somehow lost a slot, which it cannot,
   * but the guard costs nothing and a stop that does not fit must not survive.
   */
  private reorder(
    selected: PlacedStop[],
    gaps: DayGap[],
    params: RoteiroParams,
    busy: BusyInterval[],
    travel: TravelFn,
    durationOverrides: Record<number, number>,
  ): PlacedStop[] {
    const result: PlacedStop[] = [];

    for (const gap of gaps) {
      const inGap = selected.filter((stop) => stop.gapIndex === gap.index);
      if (inGap.length === 0) continue;

      const ordered = bestOrder(
        gap.from,
        gap.to,
        inGap.map((stop) => ({ ...stop, lat: stop.candidate.lat, lng: stop.candidate.lng })),
        travel,
      );

      let cursor: RoteiroPoint = gap.from;
      let clock = gap.clockStart;
      for (const stop of ordered) {
        const serviceMs = serviceMsFor(stop.candidate, params, durationOverrides);
        const point = { lat: stop.candidate.lat, lng: stop.candidate.lng };
        const drive = travel(cursor, point);
        const startsAt = pushPastBusy(clock + drive * 1000, serviceMs, busy);
        const endsAt = startsAt + serviceMs;
        const outbound = gap.to === null ? 0 : travel(point, gap.to);
        if (endsAt + outbound * 1000 > gap.endsAt) continue;

        result.push({
          candidate: stop.candidate,
          isCoverageSlot: stop.isCoverageSlot,
          gapIndex: gap.index,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          travelSeconds: drive,
        });
        cursor = point;
        clock = endsAt;
      }
    }

    return result;
  }

  /**
   * `08:00` on the planned day **in the rep's timezone**, as an instant.
   *
   * Not `Date.setHours`, which resolves against whatever timezone the API
   * process happens to run in. The workday, the lunch block and every planned
   * start belong to the rep's day, and a UTC server would otherwise put the
   * "08:00" start at 05:00 local and schedule the whole roteiro before anyone
   * is awake. Same reasoning as spec 0013 §4.3, which pins month boundaries to
   * América/São_Paulo for exactly this class of error.
   */
  private atLocalTime(scopeDate: string, hhmm: string, timeZone: string): Date {
    const [year = 0, month = 1, day = 1] = scopeDate.split("-").map(Number);
    const [hours = 0, minutes = 0] = hhmm.split(":").map(Number);
    const naiveUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    // Resolve the zone's offset at that instant, then correct. Two passes so a
    // DST boundary between the guess and the answer still lands correctly.
    let instant = naiveUtc;
    for (let pass = 0; pass < 2; pass += 1) {
      instant = naiveUtc + zoneOffsetMs(new Date(instant), timeZone);
    }
    return new Date(instant);
  }
}
