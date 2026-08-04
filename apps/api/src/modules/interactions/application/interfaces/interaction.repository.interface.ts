export type InteractionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export interface InteractionDetailRecord {
  id: string;
  calendarId: string;
  recurrenceKey: string;
  facilityId: string;
  agentUserId: string;
  modality: "IN_PERSON" | "REMOTE";
  status: InteractionStatus;
  actualStartedAt: Date | null;
  actualEndedAt: Date | null;
  correctedAt: Date | null;
  correctedByUserId: string | null;
  correctionReason: string | null;
  visitId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  calendar: {
    ownerUserId: string;
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
    id: string;
    displayName: string;
    city: string | null;
    state: string | null;
  };
  agent: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  linkedOrders: Array<{
    id: string;
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
  findById(id: string): Promise<InteractionDetailRecord | null>;
  findCommandResult(input: { id: string; command: "start" | "complete"; idempotencyKey: string }): Promise<InteractionDetailRecord | null>;
  start(input: {
    id: string;
    actorUserId: string;
    expectedVersion: number;
    idempotencyKey: string;
    startedAt: Date;
  }): Promise<InteractionMutationResult | null>;
  complete(input: {
    id: string;
    actorUserId: string;
    expectedVersion: number;
    idempotencyKey: string;
    completedAt: Date;
    scheduledStartsAt?: Date;
    correctionReason?: string;
    persistEffectiveMissed?: boolean;
  }): Promise<InteractionMutationResult | null>;
  markOverdue(input: { now: Date; limit: number; actorUserId: string | null }): Promise<number>;
}
