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
  serviceMinutes: { IN_PERSON: number; REMOTE: number };
  unitTypePolicy: Record<string, { fit: number; eligible: boolean; forceRemote: boolean }>;
  reachRadiusKm: number;
  detourBudgetKm: number;
  tauSeconds: number;
  remoteThresholdSeconds: number;
  headroomUnknown: number;
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
  funnelStage: PurchaseFunnelStage;
  bucket: RoteiroBucket;
  lat: number;
  lng: number;
  straightLineKm: number;
  orthopaedistCount: number;
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

export interface ScoreCandidatesInput {
  userId: number;
  verticalId: number;
  origin: RoteiroPoint;
  reachMode: RoteiroReachMode;
  /** Present only in `ANCORA` mode — the visit the rep has already agreed. */
  anchor: RoteiroPoint | null;
  /** Radius (LIVRE) or detour budget (ANCORA), kilometres. */
  reachBoundKm: number;
  params: RoteiroParams;
  /** Facility ids already scheduled or inside cooldown are excluded in SQL. */
  today: string;
  limit: number;
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
  findAnchorProfile(input: {
    facilityVerticalProfileId: number;
    userId: number;
    verticalId: number;
  }): Promise<{ facilityId: number; facilityName: string; lat: number; lng: number } | null>;
}
