import type { PurchaseFunnelStage } from "@atlasmed/facility-insights";

/** Spec 0016 §4.3. */
export type RoteiroBucket = "MANTER" | "RECUPERAR" | "PROSPECTAR";

/** Spec 0016 §4.1 — how the reachable set is bounded. */
export type RoteiroReachMode = "LIVRE" | "ANCORA";

export interface RoteiroPoint {
  lat: number;
  lng: number;
}

/**
 * Every tunable, per linha. Read once per generation and stored on the roteiro
 * as `params_snapshot`, so a score stays explainable after the values move
 * (spec 0016 §5.1).
 */
export interface RoteiroParams {
  verticalId: number;
  dailyLimit: number;
  weights: { t: number; h: number; n: number; v: number; k: number; c: number; q: number };
  bucketRatios: Record<RoteiroBucket, number>;
  cooldownDays: Record<RoteiroBucket, number>;
  coverageHorizonDays: Record<RoteiroBucket, number>;
  /**
   * How long a visit takes. Only in-person: the engine never proposes a call,
   * so there is no remote duration for it to choose (§4.4).
   */
  /**
   * How long a visit takes, in minutes.
   *
   * Per bucket, because one number for every clinic is plainly wrong: a
   * check-in at an account the rep knows is not a first visit to a hospital
   * they have never entered. `IN_PERSON` is the fallback and keeps rows written
   * before `byBucket` existed valid.
   *
   * Multiples of 30 by construction — the calendar rounds up to its slot
   * (§7.3), so a 45 stored here is a 60 lived, and showing 45 to the rep would
   * be a lie about their own day. Still a guess until outcome capture gives us
   * `actual_started_at`/`actual_ended_at` to fit against (§15.2); it is a
   * parameter so it costs nothing to move.
   */
  serviceMinutes: {
    IN_PERSON: number;
    byBucket?: Partial<Record<RoteiroBucket, number>>;
  };
  unitTypePolicy: Record<string, { fit: number; eligible: boolean }>;
  reachRadiusKm: number;
  detourBudgetKm: number;
  tauSeconds: number;
  remoteThresholdSeconds: number;
  headroomUnknown: number;
  /**
   * What capacity scores when CNES has no staff row for the facility at all.
   *
   * **Absent is not zero.** 216 of 1442 profiles in the book — 15 % — have no
   * row, and scoring them 0 makes a facility we know nothing about look
   * identical to one we know has no orthopaedists. Those are different claims,
   * and a load that half-failed does not announce itself: it just quietly makes
   * clinics look worthless. Same argument as `headroomUnknown` (§4.2b), same
   * neutral mid-band.
   */
  capacityUnknown: number;
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchMinutes: number;
  maxGenerationsPerDay: number;
}

/**
 * One scored candidate.
 *
 * `components` carries every raw and weighted contribution because the stop
 * card renders from it and nothing else — spec 0016 §5.2 forbids showing a rep
 * a reason that does not trace to one of these fields.
 */
export interface RoteiroCandidate {
  facilityVerticalProfileId: number;
  facilityId: number;
  facilityName: string;
  cnesCode: string | null;
  unitType: string | null;
  municipality: string | null;
  /**
   * From CNES. The only thing distinguishing branches of a chain on screen:
   * 61 name-groups in the book cover 149 facilities, and eight Vita Clínicas
   * units share one name across São Paulo. Without it two suggestions read as
   * the same clinic listed twice.
   */
  neighborhood: string | null;
  funnelStage: PurchaseFunnelStage;
  bucket: RoteiroBucket;
  lat: number;
  lng: number;
  straightLineKm: number;
  orthopaedistCount: number;
  /** Every professional CNES records at the facility, any occupation. */
  totalProfessionalCount: number;
  /** `orthopaedistCount / totalProfessionalCount`, 0 when the facility has none. */
  orthopaedistShare: number;
  /**
   * Whether CNES has any staff row for this facility.
   *
   * False means *we do not know*, never *there is nobody*. The card has to say
   * so rather than print a zero we did not measure, and the score has to sit at
   * `capacityUnknown` rather than at the bottom.
   */
  registryKnown: boolean;
  /**
   * When this rep was given the clinic. Breaks the tie among the never-covered,
   * who all share a null `lastSuggestedAt` — a book handed over 180 days ago is
   * more overdue than one handed over last week (§4.3.1).
   */
  assignmentStartedAt: Date | null;
  theirsQty: number | null;
  oursQty: number | null;
  daysSinceLastInteraction: number | null;
  daysSinceLastPurchase: number | null;
  purchaseIntervalDays: number;
  lastSuggestedAt: Date | null;
  coverageOverdue: boolean;
  meritScore: number;
  components: Record<string, { raw: number; weighted: number; [detail: string]: unknown }>;
}

/**
 * A visit the agent has already booked for the day, with somewhere to be.
 *
 * These are **derived from the calendar, never declared by the rep** — the app
 * already knows the schedule, so asking them to name it is asking for data we
 * hold. They are fixed points: the engine plans into the gaps between them and
 * routes around their locations.
 */
export interface FixedPoint {
  facilityVerticalProfileId: number | null;
  facilityId: number;
  facilityName: string;
  lat: number;
  lng: number;
  startsAt: Date;
  endsAt: Date;
}

export interface ScoreCandidatesInput {
  userId: number;
  verticalId: number;
  origin: RoteiroPoint;
  reachMode: RoteiroReachMode;
  /**
   * The day's fixed points, in time order — the agent's booked visits.
   *
   * Empty means a free day and a plain circle around the rep. Otherwise the
   * reachable set is the union of "on the way" ellipses between consecutive
   * fixed points, so a clinic counts when it is near any leg the rep is already
   * committed to driving.
   */
  fixedPoints: FixedPoint[];
  /**
   * Clinics the rep removed from the slate. Excluded from the candidate set
   * rather than filtered after scoring, so the freed slot is refilled with the
   * next best clinic instead of leaving a shorter day.
   */
  excludeProfileIds: number[];
  /**
   * Clinics the rep asked for. Kept in the shortlist **regardless of merit** —
   * a requested clinic is usually low-scoring, which is exactly why the rep had
   * to ask, and a merit-ordered cut would drop it before selection saw it.
   * Same failure the coverage slot has.
   */
  includeProfileIds: number[];
  /** Radius (LIVRE) or detour budget (ANCORA), kilometres. */
  reachBoundKm: number;
  params: RoteiroParams;
  /** Facility ids already scheduled or inside cooldown are excluded in SQL. */
  today: string;
  limit: number;
}

/** A stop as stored, with the links written on confirm. */
export interface StoredRoteiroStop {
  position: number;
  facilityVerticalProfileId: number;
  facilityId: number;
  facilityName: string;
  bucket: RoteiroBucket;
  modality: "IN_PERSON" | "REMOTE";
  serviceMinutes: number;
  travelSecondsFromPrev: number | null;
  plannedStartsAt: Date;
  plannedEndsAt: Date;
  isCoverageSlot: boolean;
  source: "SUGGESTED" | "SUBSTITUTED" | "MANUAL" | "ANCHOR";
  meritScore: number;
  scoreBreakdown: Record<string, unknown>;
  calendarId: number | null;
  interactionId: number | null;
}

export interface StoredRoteiro {
  id: number;
  userId: number;
  createdByUserId: number;
  verticalId: number;
  scopeDate: string;
  status: "DRAFT" | "CONFIRMED" | "DISCARDED" | "SUPERSEDED";
  reachMode: RoteiroReachMode;
  reachBoundKm: number;
  travelSource: "MAPBOX" | "ESTIMATED";
  anchorProfileId: number | null;
  version: number;
  notices: unknown[];
  stops: StoredRoteiroStop[];
}

export interface CreateRoteiroInput {
  userId: number;
  createdByUserId: number;
  verticalId: number;
  scopeDate: string;
  origin: RoteiroPoint;
  reachMode: RoteiroReachMode;
  anchorProfileId: number | null;
  reachBoundKm: number;
  travelSource: "MAPBOX" | "ESTIMATED";
  paramsSnapshot: Record<string, unknown>;
  notices: unknown[];
  stops: Array<Omit<StoredRoteiroStop, "calendarId" | "interactionId" | "facilityName">>;
}

export interface RoteiroRepository {
  findParams(verticalId: number): Promise<RoteiroParams | null>;
  /**
   * The §4.2 merit query. One statement: reachability, eligibility, all seven
   * components and their percentile ranks over the candidate set.
   *
   * **Contract:** returns the top `limit` candidates by merit **plus** up to a
   * handful of the most coverage-overdue ones *regardless of their merit*. So
   * the result may exceed `limit`, and any fake must honour this.
   *
   * The union is what makes the §4.3.1 coverage slot possible at all. An
   * overdue clinic is usually low-merit — that is precisely why nobody has
   * been — so a purely merit-ordered shortlist drops it before the selector
   * ever sees it, and the reserved slot silently stays empty forever.
   */
  scoreCandidates(input: ScoreCandidatesInput): Promise<RoteiroCandidate[]>;
  /** Whether the subject has an active assignment in this linha at all. */
  countAssignedProfiles(input: { userId: number; verticalId: number }): Promise<number>;
  /** Live GPS is required, so a rep with no assigned clinics is a real error. */
  /**
   * Persists a DRAFT, superseding any live one for the same (user, day).
   *
   * Regenerating replaces rather than accumulates: a partial unique index
   * allows one DRAFT or CONFIRMED roteiro per agent per day, so an orphaned
   * draft cannot block the next generation.
   */
  createDraft(input: CreateRoteiroInput): Promise<StoredRoteiro>;
  findById(id: number): Promise<StoredRoteiro | null>;
  /** Writes the calendar/interaction links produced by confirm onto one stop. */
  linkStop(input: {
    roteiroId: number;
    position: number;
    calendarId: number;
    interactionId: number;
  }): Promise<void>;
  /**
   * Marks the roteiro confirmed and stamps `last_suggested_at` on every stop's
   * profile — the write that makes the §4.3.1 coverage rotation actually turn.
   *
   * On confirm, never on generation: a clinic in a draft the rep discarded has
   * not been covered, and marking it covered would let the book rot behind a
   * rep who regenerates ten times a morning.
   */
  markConfirmed(input: { roteiroId: number; confirmedAt: Date }): Promise<void>;
  /**
   * The agent's own clinics for this linha, for the "add a clinic" picker.
   *
   * Deliberately **not** filtered by reachability or cooldown: a rep adding a
   * clinic by hand knows something the engine does not, and a picker that hid
   * the clinic they were told to visit would be worse than no picker. The day
   * still has to hold it — that check belongs to generation, which reports when
   * it cannot.
   */
  searchAddableClinics(input: {
    userId: number;
    verticalId: number;
    query: string | null;
    limit: number;
  }): Promise<
    Array<{
      facilityVerticalProfileId: number;
      facilityId: number;
      facilityName: string;
      municipality: string | null;
      neighborhood: string | null;
      funnelStage: string;
    }>
  >;

  /**
   * Locations for facilities the agent is already booked into today, so those
   * visits can act as fixed points rather than merely blocked time.
   */
  locateFacilities(input: {
    facilityIds: number[];
    verticalId: number;
  }): Promise<
    Array<{
      facilityId: number;
      facilityVerticalProfileId: number | null;
      facilityName: string;
      lat: number;
      lng: number;
    }>
  >;
}
