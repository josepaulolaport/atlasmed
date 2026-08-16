import type { CalendarConflictEntry } from "../services/conflict.service";
import type { CalendarRecurrence } from "../services/recurrence.service";

export type CalendarEventKind = "INTERACTION" | "PERSONAL_BLOCK";
export type InteractionModality = "IN_PERSON" | "REMOTE";
export type InteractionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "NOT_COMPLETED" | "CANCELLED";

export interface CalendarOverrideRecord {
  id: number;
  calendarId: number;
  recurrenceKey: string;
  startsAt: Date;
  endsAt: Date;
  status: "ACTIVE" | "CANCELLED";
  reason: string | null;
  version: number;
}

export interface CalendarCommandReceipt<T> {
  commandKind: string;
  resourceId: number | null;
  requestFingerprint: string;
  result: T;
}

export interface CalendarInteractionRecord {
  id: number;
  recurrenceKey: string;
  /** Null only for a contact with a person that happened nowhere (§15.7.5). */
  facilityId: number | null;
  /** The doctor, when the rep booked the person rather than the place. */
  personId?: number | null;
  person?: { id: number; name: string } | null;
  modality: InteractionModality;
  status: InteractionStatus;
  cancelledAt?: Date | null;
  cancelledByUserId?: number | null;
  cancellationReason?: string | null;
  visitId?: number | null;
  linkedOrderCount?: number;
  version: number;
  actualStartedAt?: Date | null;
  actualEndedAt?: Date | null;
  lifecycleEventCount?: number;
}

export interface CalendarEventRecord {
  id: number;
  ownerUserId: number;
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
  cancelledByUserId: number | null;
  cancellationReason: string | null;
  version: number;
  owner: { id: number; name: string };
  facility: { id: number; name: string } | null;
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
    facilityId: number | null;
    personId: number | null;
    agentUserId: number;
    modality: InteractionModality;
  };
}

export interface UpdateCalendarEventInput {
  id: number;
  expectedVersion: number;
  commandKey: string;
  changes: Partial<Pick<CalendarEventRecord, "title" | "anchorLocalDate" | "anchorLocalTime" | "timeZone" | "durationMinutes" | "firstStartsAt" | "firstEndsAt" | "recurrence" | "recurrenceUntil" | "recurrenceCount">>;
}

export interface UpsertCalendarOverrideInput {
  calendarId: number;
  recurrenceKey: string;
  startsAt: Date;
  endsAt: Date;
  status: "ACTIVE" | "CANCELLED";
  reason?: string | null;
  actorUserId: number;
  previousStartsAt?: Date;
  previousEndsAt?: Date;
  expectedVersion: number;
  commandKey: string;
}

export interface CancelCalendarEventInput {
  id: number;
  expectedVersion: number;
  actorUserId: number;
  reason: string;
  commandKey: string;
}

export interface CalendarRepository {
  runWithOwnerLock<T>(ownerUserId: number, work: (repository: CalendarRepository) => Promise<T>): Promise<T>;
  listByOwner(ownerUserId: number, range?: { from: Date; to: Date }): Promise<CalendarEventRecord[]>;
  findById(id: number): Promise<CalendarEventRecord | null>;
  listConflictEntries(ownerUserId: number, excludeCalendarId?: number, range?: { from: Date; to?: Date }): Promise<CalendarConflictEntry[]>;
  ensureInteractionsForOccurrences(calendarId: number, recurrenceKeys: string[]): Promise<CalendarInteractionRecord[]>;
  cancelInteractionOccurrences(input: { calendarId: number; recurrenceKeys?: string[]; actorUserId: number; reason: string }): Promise<number>;
  getCommandReceipt<T>(ownerUserId: number, commandKey: string): Promise<CalendarCommandReceipt<T> | undefined>;
  saveCommandReceipt<T>(ownerUserId: number, commandKey: string, commandKind: string, resourceId: number | null, requestFingerprint: string, result: T): Promise<CalendarCommandReceipt<T>>;
  /**
   * The clinics a person currently works at, for the §15.7.5 scope rule.
   *
   * Permissions are facility-based and a contact with no clinic has nothing for
   * them to bite on, so the rep may book a person who works at *at least one*
   * clinic they can already see. Active links only: someone who left a clinic
   * last year does not lend their old employer's permissions to anybody.
   */
  listPersonFacilityIds(personId: number): Promise<number[]>;
  /** The owner's own end of day, `hh:mm`, or null for the linha default. */
  findWorkdayEnd(userId: number): Promise<string | null>;
  create(input: CreateCalendarEventInput): Promise<CalendarEventRecord>;
  update(input: UpdateCalendarEventInput): Promise<CalendarEventRecord | null>;
  replaceUntouchedInteractions(input: { calendarId: number; recurrenceKeyMap: Array<{ oldRecurrenceKey: string; newRecurrenceKey: string }> }): Promise<boolean>;
  upsertOverride(input: UpsertCalendarOverrideInput): Promise<CalendarOverrideRecord | null>;
  deleteInvalidOverrides(calendarId: number, recurrenceKeys: string[]): Promise<boolean>;
  cancel(input: CancelCalendarEventInput): Promise<CalendarEventRecord | null>;
}
