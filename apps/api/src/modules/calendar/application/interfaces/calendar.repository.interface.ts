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
  cancelledAt?: Date | null;
  cancelledByUserId?: string | null;
  cancellationReason?: string | null;
  visitId?: string | null;
  linkedOrderCount?: number;
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
  firstStartsAt: Date | null;
  firstEndsAt: Date | null;
  recurrence: CalendarRecurrence;
  recurrenceUntil: string | null;
  recurrenceCount: number | null;
  status: "ACTIVE" | "CANCELLED";
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  version: number;
  owner: { id: string; name: string };
  facility: { id: string; name: string } | null;
  overrides: CalendarOverrideRecord[];
  interactions: CalendarInteractionRecord[];
}

export interface CreateCalendarEventInput {
  commandKey: string;
  event: Omit<CalendarEventRecord, "id" | "version" | "owner" | "facility" | "overrides" | "interactions" | "status" | "cancelledAt" | "cancelledByUserId" | "cancellationReason"> & {
    firstStartsAt: Date;
    firstEndsAt: Date;
  };
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
  actorUserId: string;
  previousStartsAt?: Date;
  previousEndsAt?: Date;
  expectedVersion: number;
  commandKey: string;
}

export interface CancelCalendarEventInput {
  id: string;
  expectedVersion: number;
  actorUserId: string;
  reason: string;
  commandKey: string;
}

export interface CalendarRepository {
  runWithOwnerLock<T>(ownerUserId: string, work: (repository: CalendarRepository) => Promise<T>): Promise<T>;
  listByOwner(ownerUserId: string, range?: { from: Date; to: Date }): Promise<CalendarEventRecord[]>;
  findById(id: string): Promise<CalendarEventRecord | null>;
  listConflictEntries(ownerUserId: string, excludeCalendarId?: string, range?: { from: Date; to?: Date }): Promise<CalendarConflictEntry[]>;
  ensureInteractionsForOccurrences(calendarId: string, recurrenceKeys: string[]): Promise<CalendarInteractionRecord[]>;
  cancelInteractionOccurrences(input: { calendarId: string; recurrenceKeys?: string[]; actorUserId: string; reason: string }): Promise<number>;
  getCommandReceipt<T>(ownerUserId: string, commandKey: string): Promise<T | undefined>;
  saveCommandReceipt<T>(ownerUserId: string, commandKey: string, commandKind: string, resourceId: string | null, result: T): Promise<T>;
  create(input: CreateCalendarEventInput): Promise<CalendarEventRecord>;
  update(input: UpdateCalendarEventInput): Promise<CalendarEventRecord | null>;
  upsertOverride(input: UpsertCalendarOverrideInput): Promise<CalendarOverrideRecord | null>;
  deleteInvalidOverrides(calendarId: string, recurrenceKeys: string[]): Promise<boolean>;
  cancel(input: CancelCalendarEventInput): Promise<CalendarEventRecord | null>;
}
