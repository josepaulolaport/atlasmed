export type InteractionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

/** §15.6.4 — how the visit went, in the rep's own terms. */
export type InteractionOutcome =
  | "PEDIDO"
  | "VAI_AVALIAR"
  | "RELACIONAMENTO"
  | "NAO_FALEI_COM_NINGUEM";

/** §15.6.4 — when to come back. Governs the §4.3.1 coverage rotation. */
export type InteractionFollowUp = "NENHUM" | "DIAS_15" | "DIAS_30" | "DIAS_90";

export interface InteractionDetailRecord {
  id: number;
  calendarId: number;
  recurrenceKey: string;
  facilityId: number;
  agentUserId: number;
  modality: "IN_PERSON" | "REMOTE";
  status: InteractionStatus;
  actualStartedAt: Date | null;
  outcome: InteractionOutcome | null;
  followUp: InteractionFollowUp | null;
  outcomeAnsweredAt: Date | null;
  actualEndedAt: Date | null;
  correctedAt: Date | null;
  correctedByUserId: number | null;
  correctionReason: string | null;
  visitId: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  calendar: {
    ownerUserId: number;
    title: string;
    anchorLocalDate: string;
    anchorLocalTime: string;
    timeZone: string;
    durationMinutes: number;
    recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    recurrenceUntil: string | null;
    recurrenceCount: number | null;
    status: "ACTIVE" | "CANCELLED";
    version: number;
  };
  occurrenceOverride: {
    startsAt: Date;
    endsAt: Date;
    status: "ACTIVE" | "CANCELLED";
    version: number;
  } | null;
  facility: {
    id: number;
    displayName: string;
    city: string | null;
    state: string | null;
  };
  agent: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  };
  linkedOrders: Array<{
    id: number;
    status: string;
    type: string;
    orderedAt: Date;
  }>;
}

export interface InteractionMutationResult {
  interaction: InteractionDetailRecord;
  replayed: boolean;
}

export interface InteractionRepository {
  findById(id: number): Promise<InteractionDetailRecord | null>;
  findCommandResult(input: { id: number; command: "start" | "complete"; idempotencyKey: string }): Promise<InteractionDetailRecord | null>;
  start(input: {
    id: number;
    actorUserId: number;
    expectedVersion: number;
    idempotencyKey: string;
    startedAt: Date;
  }): Promise<InteractionMutationResult | null>;
  complete(input: {
    id: number;
    actorUserId: number;
    expectedVersion: number;
    idempotencyKey: string;
    completedAt: Date;
    scheduledStartsAt?: Date;
    correctionReason?: string;
    persistEffectiveMissed?: boolean;
  }): Promise<InteractionMutationResult | null>;
  /**
   * Closes visits the rep walked away from — spec 0016 §15.6.1.
   *
   * `INFERRED`, always: nobody witnessed the ending, so it must never train the
   * duration model (§15.6.2).
   */
  /**
   * Records the two questions asked on the way out — spec 0016 §15.6.4.
   *
   * Separate from `complete` because the visit is often already closed by the
   * time anyone answers: an arrival closed it, or the workday-end job did, and
   * the rep is answering afterwards. Returns null when the interaction is not
   * in a state that can carry an outcome.
   */
  recordOutcome(input: {
    id: number;
    actorUserId: number;
    outcome: InteractionOutcome;
    followUp: InteractionFollowUp;
    answeredAt: Date;
  }): Promise<InteractionDetailRecord | null>;

  closeStaleVisits(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number>;

  markOverdue(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number>;
}
