import type { CalendarConflictEntry } from "../services/conflict.service";
import type { CalendarRecurrence } from "../services/recurrence.service";

export type CalendarEventKind = "INTERACTION" | "PERSONAL_BLOCK";
export type InteractionModality = "IN_PERSON" | "REMOTE";
export type InteractionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "NOT_COMPLETED" | "CANCELLED";

export interface CalendarOverrideRecord {
  id: string;
  calendarId: string;
  recurrenceKey: string;
  startsAt: Date;
  endsAt: Date;
  status: "ACTIVE" | "CANCELLED";
  reason: string | null;
  version: number;
}

export interface CalendarInteractionRecord {
  id: string;
  recurrenceKey: string;
  facilityId: string;
  modality: InteractionModality;
  status: InteractionStatus;
  version: number;
}

export interface CalendarEventRecord {
  id: string;
  ownerUserId: string;
  kind: CalendarEventKind;
  title: string;
  anchorLocalDate: string;
  anchorLocalTime: string;
  timeZone: string;
  durationMinutes: number;
  firstStartsAt: Date;
  firstEndsAt: Date;
  recurrence: CalendarRecurrence;
  recurrenceUntil: string | null;
  recurrenceCount: number | null;
  version: number;
  overrides: CalendarOverrideRecord[];
  interactions: CalendarInteractionRecord[];
}

export interface CreateCalendarEventInput {
  commandKey: string;
  event: Omit<CalendarEventRecord, "id" | "version" | "overrides" | "interactions">;
  interaction?: {
    recurrenceKey: string;
    facilityId: string;
    agentUserId: string;
    modality: InteractionModality;
  };
}

export interface UpdateCalendarEventInput {
  id: string;
  expectedVersion: number;
  commandKey: string;
  changes: Partial<Pick<CalendarEventRecord, "title" | "anchorLocalDate" | "anchorLocalTime" | "timeZone" | "durationMinutes" | "firstStartsAt" | "firstEndsAt" | "recurrence" | "recurrenceUntil" | "recurrenceCount">>;
}

export interface UpsertCalendarOverrideInput {
  calendarId: string;
  recurrenceKey: string;
  startsAt: Date;
  endsAt: Date;
  status: "ACTIVE" | "CANCELLED";
  reason?: string | null;
  expectedVersion: number;
  commandKey: string;
}

export interface DeleteCalendarEventInput {
  id: string;
  expectedVersion: number;
  reason?: string;
  commandKey?: string;
}

export interface CalendarRepository {
  runWithOwnerLock<T>(ownerUserId: string, work: (repository: CalendarRepository) => Promise<T>): Promise<T>;
  listByOwner(ownerUserId: string): Promise<CalendarEventRecord[]>;
  findById(id: string): Promise<CalendarEventRecord | null>;
  listConflictEntries(ownerUserId: string, excludeCalendarId?: string): Promise<CalendarConflictEntry[]>;
  create(input: CreateCalendarEventInput): Promise<CalendarEventRecord>;
  update(input: UpdateCalendarEventInput): Promise<CalendarEventRecord | null>;
  upsertOverride(input: UpsertCalendarOverrideInput): Promise<CalendarOverrideRecord | null>;
  delete(input: DeleteCalendarEventInput): Promise<boolean>;
}
