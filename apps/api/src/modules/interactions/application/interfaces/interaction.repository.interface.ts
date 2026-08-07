export type InteractionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export interface InteractionDetailRecord {
  id: number;
  calendarId: number;
  recurrenceKey: string;
  facilityId: number;
  agentUserId: number;
  modality: "IN_PERSON" | "REMOTE";
  status: InteractionStatus;
  actualStartedAt: Date | null;
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
  markOverdue(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number>;
}
