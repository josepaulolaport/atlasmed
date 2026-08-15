import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
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

/** §4.1 — how far the bound may widen before we give up, and in what steps. */
const REACH_EXPANSION_STEPS = [1, 2, 4, 8] as const;
/** Shortlist depth, per §4.5. */
const SHORTLIST_FACTOR = 4;

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
  /** Present turns the generation into `ANCORA` mode. */
  anchorProfileId?: number;
  limit?: number;
  today: string;
  now: Date;
  /** Defaults to `APP_TIME_ZONE`. The workday is the rep's, not the server's. */
  timeZone?: string;
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
  constructor(private readonly deps: { repository: RoteiroRepository }) {}

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

    const { reachMode, anchor, anchorProfileId } = await this.resolveAnchor(input, subjectUserId);

    const { candidates, reachBoundKm, expanded } = await this.reach({
      input,
      subjectUserId,
      params,
      reachMode,
      anchor,
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

    const selected = this.select({
      candidates,
      limit,
      params,
      notices,
      anchorProfileId,
      origin: input.origin,
    });
    const stops = this.schedule({
      selected,
      origin: input.origin,
      params,
      now: input.now,
      scopeDate: input.today,
      timeZone: input.timeZone ?? APP_TIME_ZONE,
    });

    return {
      subjectUserId,
      verticalId: input.verticalId,
      scopeDate: input.today,
      origin: input.origin,
      reachMode,
      anchorProfileId,
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
   * person's day. Confirming is a separate, stricter gate (spec 0016 §7.3) —
   * writing to someone's calendar stays theirs alone.
   */
  private assertMayPlanFor(input: GenerateRoteiroInput, subjectUserId: number): void {
    if (subjectUserId === input.actor.userId) return;
    if (input.actor.roleName === "ADMIN" && input.scope.isGlobal) return;
    if (
      input.actor.roleName === "MANAGER" &&
      input.scope.managedUserIds.includes(subjectUserId)
    ) {
      return;
    }
    throw new ForbiddenError("Roteiro is outside the current owner/team scope");
  }

  private async resolveAnchor(input: GenerateRoteiroInput, subjectUserId: number) {
    if (input.anchorProfileId === undefined) {
      return { reachMode: "LIVRE" as RoteiroReachMode, anchor: null, anchorProfileId: null };
    }
    const found = await this.deps.repository.findAnchorProfile({
      facilityVerticalProfileId: input.anchorProfileId,
      userId: subjectUserId,
      verticalId: input.verticalId,
    });
    if (!found) {
      throw new ResourceNotFoundError("Clínica âncora", input.anchorProfileId);
    }
    return {
      reachMode: "ANCORA" as RoteiroReachMode,
      anchor: { lat: found.lat, lng: found.lng },
      anchorProfileId: input.anchorProfileId,
    };
  }

  /** §4.1 — widen the bound until the shortlist is deep enough, or give up. */
  private async reach(args: {
    input: GenerateRoteiroInput;
    subjectUserId: number;
    params: RoteiroParams;
    reachMode: RoteiroReachMode;
    anchor: RoteiroPoint | null;
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
        anchor: args.anchor,
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
    anchorProfileId: number | null;
    origin: RoteiroPoint;
  }) {
    const { candidates, limit, params, notices, anchorProfileId, origin } = args;
    const quotas = bucketQuotas(limit, params.bucketRatios);
    const taken = new Set<number>();
    const chosen: { candidate: RoteiroCandidate; isCoverageSlot: boolean; isAnchor: boolean }[] = [];

    // The anchor is a fixed commitment, not a suggestion — it takes position 0
    // and never competes for a quota slot.
    if (anchorProfileId !== null) {
      const anchorCandidate = candidates.find(
        (c) => c.facilityVerticalProfileId === anchorProfileId,
      );
      if (anchorCandidate) {
        taken.add(anchorCandidate.facilityVerticalProfileId);
        chosen.push({ candidate: anchorCandidate, isCoverageSlot: false, isAnchor: true });
      }
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
      taken.add(coverage.facilityVerticalProfileId);
      chosen.push({ candidate: coverage, isCoverageSlot: true, isAnchor: false });
      quotas[coverage.bucket] = Math.max(0, quotas[coverage.bucket] - 1);
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
    let cursor: RoteiroPoint =
      chosen.length > 0
        ? { lat: chosen[chosen.length - 1]!.candidate.lat, lng: chosen[chosen.length - 1]!.candidate.lng }
        : origin;

    while (chosen.length < limit) {
      let best: { candidate: RoteiroCandidate; gain: number } | null = null;
      for (const candidate of candidates) {
        if (taken.has(candidate.facilityVerticalProfileId)) continue;
        const here = { lat: candidate.lat, lng: candidate.lng };
        const serviceSeconds = params.serviceMinutes.IN_PERSON * 60;
        const deltaCost = estimatedTravelSeconds(cursor, here) + serviceSeconds;
        // A filled bucket is not banned, only outbid — otherwise a slate with
        // nothing left in one bucket would come back short.
        const quotaMultiplier = (remainingQuota[candidate.bucket] ?? 0) > 0 ? 1 : 0.35;
        const gain = (candidate.meritScore * quotaMultiplier) / (deltaCost + tau);
        if (!best || gain > best.gain) best = { candidate, gain };
      }
      if (!best) break;
      taken.add(best.candidate.facilityVerticalProfileId);
      chosen.push({ candidate: best.candidate, isCoverageSlot: false, isAnchor: false });
      remainingQuota[best.candidate.bucket] = Math.max(
        0,
        (remainingQuota[best.candidate.bucket] ?? 0) - 1,
      );
      cursor = { lat: best.candidate.lat, lng: best.candidate.lng };
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

    if (chosen.length < limit && candidates.length > 0) {
      notices.push({
        code: "SHORT_SLATE",
        requested: limit,
        filled: chosen.length,
        message: `Apenas ${chosen.length} de ${limit} clínicas elegíveis ao alcance.`,
      });
    }

    return chosen;
  }

  /**
   * Order and time the day.
   *
   * P1 orders by nearest-neighbour from the origin using straight-line
   * estimates — no Matrix call, no merit-per-hour optimisation. That is P2
   * (§4.5). The anchor, when present, stays at position 0 because its time was
   * agreed with the clinic, not chosen by us.
   */
  private schedule(args: {
    selected: { candidate: RoteiroCandidate; isCoverageSlot: boolean; isAnchor: boolean }[];
    origin: RoteiroPoint;
    params: RoteiroParams;
    now: Date;
    scopeDate: string;
    timeZone: string;
  }): PlannedStop[] {
    const { params } = args;
    const anchored = args.selected.filter((s) => s.isAnchor);
    const remaining = args.selected.filter((s) => !s.isAnchor);

    // No re-ordering here. §4.5 selection appends each stop to the route as it
    // chooses it, so the order is already the one the gain rule paid for —
    // re-sorting by nearest-neighbour afterwards would discard that decision.
    const ordered = [...anchored, ...remaining];

    const dayStart = this.atLocalTime(args.scopeDate, params.workdayStart, args.timeZone);
    const lunchStart = this.atLocalTime(args.scopeDate, params.lunchStart, args.timeZone);
    const lunchEnd = new Date(lunchStart.getTime() + params.lunchMinutes * 60_000);
    let clock = new Date(Math.max(args.now.getTime(), dayStart.getTime()));
    let previous: RoteiroPoint = args.origin;

    return ordered.map((entry, position) => {
      const policy =
        params.unitTypePolicy[entry.candidate.unitType ?? ""] ?? params.unitTypePolicy["*"];
      const modality: "IN_PERSON" | "REMOTE" = policy?.forceRemote ? "REMOTE" : "IN_PERSON";
      const here = { lat: entry.candidate.lat, lng: entry.candidate.lng };
      const travelSeconds = modality === "REMOTE" ? null : estimatedTravelSeconds(previous, here);
      const serviceMinutes =
        modality === "REMOTE" ? params.serviceMinutes.REMOTE : params.serviceMinutes.IN_PERSON;

      let startsAt = new Date(clock.getTime() + (travelSeconds ?? 0) * 1000);
      // Never schedule through lunch: push the whole stop past it.
      if (startsAt < lunchEnd && startsAt.getTime() + serviceMinutes * 60_000 > lunchStart.getTime()) {
        startsAt = lunchEnd;
      }
      const endsAt = new Date(startsAt.getTime() + serviceMinutes * 60_000);

      clock = endsAt;
      if (modality === "IN_PERSON") previous = here;

      return {
        candidate: entry.candidate,
        position,
        modality,
        modalitySource: "SUGGESTED" as const,
        isCoverageSlot: entry.isCoverageSlot,
        isAnchor: entry.isAnchor,
        travelSecondsFromPrev: travelSeconds,
        serviceMinutes,
        plannedStartsAt: startsAt,
        plannedEndsAt: endsAt,
      };
    });
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
