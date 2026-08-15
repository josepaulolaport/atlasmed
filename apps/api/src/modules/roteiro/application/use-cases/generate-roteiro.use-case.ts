import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
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
  serviceMinutes: { IN_PERSON: 45, REMOTE: 15 },
  unitTypePolicy: {
    "Clinica/Centro de Especialidade": { fit: 1.0, eligible: true, forceRemote: false },
    "Hospital/Dia - Isolado": { fit: 1.0, eligible: true, forceRemote: false },
    Policlinica: { fit: 0.55, eligible: true, forceRemote: false },
    "Consultorio Isolado": { fit: 0.35, eligible: true, forceRemote: false },
    "Hospital Especializado": { fit: 0.35, eligible: true, forceRemote: false },
    // Below what conversion alone justifies (3.5% vs a clinic's 9.6%), by
    // commercial decision: a hospital visit costs more of a rep's day in
    // access and gatekeeping, and purchasing is centralised and slower.
    "Hospital Geral": { fit: 0.15, eligible: true, forceRemote: false },
    "*": { fit: 0.05, eligible: true, forceRemote: false },
  },
  reachRadiusKm: 60,
  detourBudgetKm: 20,
  tauSeconds: 900,
  remoteThresholdSeconds: 2700,
  headroomUnknown: 0.4,
  workdayStart: "08:00",
  workdayEnd: "18:00",
  lunchStart: "12:00",
  lunchMinutes: 60,
  maxGenerationsPerDay: 20,
};

/**
 * Straight-line kilometres understate a drive. 1.35 is the usual circuity
 * factor for Brazilian urban road networks, and 28 km/h a conservative mixed
 * urban average.
 *
 * These produce **estimates and are labelled as such** end to end
 * (`travelSource = ESTIMATED`, spec 0016 §4.8). P2 replaces them with the
 * Mapbox Matrix. They exist so P1 ships something useful without a paid
 * dependency — and so the feature keeps working in the field when Mapbox is
 * unreachable, which is the situation a rep is most likely to be in.
 */
const ROAD_CIRCUITY_FACTOR = 1.35;
const AVERAGE_SPEED_KMH = 28;

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

function toCalendarSlot(minutes: number): number {
  return Math.max(
    CALENDAR_SLOT_MINUTES,
    Math.ceil(minutes / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_MINUTES,
  );
}

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
      interaction?: { facilityId: number };
    }>
  >;
}

interface BusyInterval {
  startsAt: number;
  endsAt: number;
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
  origin: RoteiroPoint;
  limit?: number;
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
): { startsAt: number; endsAt: number; travelSeconds: number; addedSeconds: number } | null {
  const inbound = estimatedTravelSeconds(gap.cursor, point);
  const startsAt = pushPastBusy(gap.clock + inbound * 1000, serviceMs, busy);
  const endsAt = startsAt + serviceMs;

  const outbound = gap.to === null ? 0 : estimatedTravelSeconds(point, gap.to);
  // Bounded gaps must still allow the rep to reach the next commitment.
  if (endsAt + outbound * 1000 > gap.endsAt) return null;

  const direct = gap.to === null ? 0 : estimatedTravelSeconds(gap.cursor, gap.to);
  return {
    startsAt,
    endsAt,
    travelSeconds: inbound,
    addedSeconds: Math.max(0, inbound + outbound - direct),
  };
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
    private readonly deps: { repository: RoteiroRepository; schedule?: ScheduleReader },
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
    if (!stored) {
      notices.push({
        code: "PARAMS_DEFAULTED",
        message: "Parâmetros padrão em uso — nenhuma configuração salva para esta linha.",
        verticalId: input.verticalId,
      });
    }

    const limit = Math.min(input.limit ?? params.dailyLimit, params.dailyLimit);
    if (limit < 1) {
      throw new ValidationError([{ field: "limit", message: "limit must be at least 1" }]);
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

    const { candidates, reachBoundKm, expanded } = await this.reach({
      input,
      subjectUserId,
      params,
      reachMode,
      fixedPoints,
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

    const dayEnd = this.atLocalTime(input.today, params.workdayEnd, timeZone);
    const gaps = buildGaps({
      origin: input.origin,
      fixedPoints,
      from: Math.max(input.now.getTime(), this.atLocalTime(input.today, params.workdayStart, timeZone).getTime()),
      dayEnd: dayEnd.getTime(),
    });

    const selected = this.select({ candidates, limit, params, notices, gaps, busy });

    // Selection placed every stop inside a gap, so ordering is just time order
    // and there is no second pass that could disagree with it.
    const stops: PlannedStop[] = [...selected]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((placed, position) => {
        const policy =
          params.unitTypePolicy[placed.candidate.unitType ?? ""] ?? params.unitTypePolicy["*"];
        const modality: "IN_PERSON" | "REMOTE" = policy?.forceRemote ? "REMOTE" : "IN_PERSON";
        return {
          candidate: placed.candidate,
          position,
          modality,
          modalitySource: "SUGGESTED" as const,
          isCoverageSlot: placed.isCoverageSlot,
          isAnchor: false,
          travelSecondsFromPrev: modality === "REMOTE" ? null : placed.travelSeconds,
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
          origin: input.origin,
          reachMode,
          anchorProfileId: fixedPoints[0]?.facilityVerticalProfileId ?? null,
          reachBoundKm,
          travelSource: "ESTIMATED",
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
      origin: input.origin,
      reachMode,
      anchorProfileId: fixedPoints[0]?.facilityVerticalProfileId ?? null,
      fixedPoints: fixedPoints.map((point) => ({
        facilityId: point.facilityId,
        facilityName: point.facilityName,
        startsAt: point.startsAt,
        endsAt: point.endsAt,
      })),
      reachBoundKm,
      travelSource: "ESTIMATED" as const,
      params,
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
        const place = facilityId === undefined ? undefined : byFacility.get(facilityId);
        // A booked visit at a facility with no coordinates still blocks the
        // clock; it just cannot anchor the route.
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
        origin: args.input.origin,
        reachMode: args.reachMode,
        fixedPoints: args.fixedPoints,
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
  }) {
    const { candidates, limit, params, notices, gaps, busy } = args;
    const quotas = bucketQuotas(limit, params.bucketRatios);
    const taken = new Set<number>();
    const chosen: PlacedStop[] = [];

    // Booked visits are deliberately **not** selected here. They are already in
    // the rep's calendar; the engine plans around them rather than proposing
    // them back. They shape the route through §4.1 reachability and the §4.5
    // cost model, not through the slate.

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
      const policy = params.unitTypePolicy[coverage.unitType ?? ""] ?? params.unitTypePolicy["*"];
      const serviceMs =
        toCalendarSlot(
          policy?.forceRemote ? params.serviceMinutes.REMOTE : params.serviceMinutes.IN_PERSON,
        ) * 60_000;
      // The reserved slot still has to fit somewhere real. If the day cannot
      // hold it, it is not taken — a coverage stop the rep cannot make is not
      // coverage.
      let placed: { gap: DayGap; at: NonNullable<ReturnType<typeof fitInGap>> } | null = null;
      for (const gap of gaps) {
        const at = fitInGap(gap, { lat: coverage.lat, lng: coverage.lng }, serviceMs, busy);
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
        const policy =
          params.unitTypePolicy[candidate.unitType ?? ""] ?? params.unitTypePolicy["*"];
        const modality = policy?.forceRemote ? "REMOTE" : "IN_PERSON";
        const serviceMs =
          toCalendarSlot(
            modality === "REMOTE" ? params.serviceMinutes.REMOTE : params.serviceMinutes.IN_PERSON,
          ) * 60_000;
        const point = { lat: candidate.lat, lng: candidate.lng };

        for (const gap of gaps) {
          const placement = fitInGap(gap, point, serviceMs, busy);
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

    for (const bucket of ["PROSPECTAR", "MANTER", "RECUPERAR"] as RoteiroBucket[]) {
      const filled = chosen.filter((c) => c.candidate.bucket === bucket).length;
      if (filled < quotas[bucket]) {
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
    }

    return chosen;
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
