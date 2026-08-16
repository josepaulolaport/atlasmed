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
  /** Null for a contact with a person that happened nowhere (§15.7.5). */
  facilityId: number | null;
  personId: number | null;
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
    recurrence: "NONE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY" | "YEARLY";
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
  } | null;
  /** Who the contact was with, when it was booked against a person. */
  person: {
    id: number;
    name: string;
  } | null;
  agent: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  };

  /**
   * The rep's own end of day (§15.5.5), `hh:mm` or null for the linha default.
   *
   * Read here because it decides how long a planned visit stays startable: a
   * rep running late is recording a real visit, not filing a correction.
   */
  agentWorkdayEnd: string | null;
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

  /**
   * A visit to a clinic that was never on the roteiro — spec 0016 §15.6.3.
   *
   * Creates the calendar row and the interaction together, already started,
   * and closes whatever the rep left open. There is no scheduled appointment to
   * start, so this cannot go through `start`: the record is being made because
   * the rep is standing there, not because a plan said they would be.
   *
   * Deliberately does not run the calendar conflict check. Arriving somewhere
   * is a fact; refusing to record it because the rep's own calendar disagrees
   * is precisely the "system that can only record its own suggestions" the
   * spec warns about.
   */
  recordArrival(input: {
    facilityId: number;
    agentUserId: number;
    title: string;
    timeZone: string;
    anchorLocalDate: string;
    anchorLocalTime: string;
    recurrenceKey: string;
    durationMinutes: number;
    startedAt: Date;
    idempotencyKey: string;
  }): Promise<InteractionDetailRecord>;

  /** Replay for [recordArrival]; the interaction has no id to key on yet. */
  findArrival(input: { agentUserId: number; idempotencyKey: string }): Promise<InteractionDetailRecord | null>;

  /**
   * The visit this rep already has booked at this clinic on this local day, if
   * any — so an arrival can start *that* rather than mint a second row.
   *
   * Only one that has not started: a visit already in progress or closed is a
   * different visit, and a rep who walks back into the same clinic in the
   * afternoon means the second one.
   */
  findPlannedVisitAt(input: {
    agentUserId: number;
    facilityId: number;
    localDate: string;
    timeZone: string;
  }): Promise<InteractionDetailRecord | null>;

  /** The clinic being arrived at, or null when it does not exist. */
  findFacilitySummary(id: number): Promise<{ id: number; displayName: string } | null>;

  closeStaleVisits(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number>;

  markOverdue(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number>;
}
