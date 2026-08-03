import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { calendar, calendarCommandReceipts, calendarOccurrenceOverrides, interactions, type AnyDatabase } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import type {
  CalendarEventRecord,
  CalendarInteractionRecord,
  CalendarOverrideRecord,
  CalendarRepository,
  CancelCalendarEventInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  UpsertCalendarOverrideInput,
} from "../../../application/interfaces/calendar.repository.interface";
import type { CalendarConflictEntry } from "../../../application/services/conflict.service";

function mapOverride(row: typeof calendarOccurrenceOverrides.$inferSelect): CalendarOverrideRecord {
  return { id: row.id, calendarId: row.calendarId, recurrenceKey: row.recurrenceKey, startsAt: row.startsAt,
    endsAt: row.endsAt, status: row.status, reason: row.reason, version: row.version };
}
function mapInteraction(row: typeof interactions.$inferSelect): CalendarInteractionRecord {
  return { id: row.id, recurrenceKey: row.recurrenceKey, facilityId: row.facilityId, modality: row.modality,
    status: row.status, version: row.version };
}
export function mapCalendarEvent(row: typeof calendar.$inferSelect, overrides: CalendarOverrideRecord[] = [], interactionRows: CalendarInteractionRecord[] = []): CalendarEventRecord {
  return { id: row.id, ownerUserId: row.ownerUserId, kind: row.kind, title: row.title,
    anchorLocalDate: row.anchorLocalDate, anchorLocalTime: row.anchorLocalTime.slice(0, 5), timeZone: row.timeZone,
    durationMinutes: row.durationMinutes, firstStartsAt: row.firstStartsAt ?? null, firstEndsAt: row.firstEndsAt ?? null,
    recurrence: row.recurrence, recurrenceUntil: row.recurrenceUntil, recurrenceCount: row.recurrenceCount,
    status: row.status, cancelledAt: row.cancelledAt, cancelledByUserId: row.cancelledByUserId,
    cancellationReason: row.cancellationReason, version: row.version, overrides, interactions: interactionRows };
}

export class DrizzleCalendarRepository implements CalendarRepository {
  constructor(
    private readonly database: AnyDatabase = db,
    private readonly transactionScoped = false,
  ) {}

  async runWithOwnerLock<T>(ownerUserId: string, work: (repository: CalendarRepository) => Promise<T>): Promise<T> {
    if (this.transactionScoped) return work(this);
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerUserId}))`);
      return work(new DrizzleCalendarRepository(tx, true));
    });
  }

  private async hydrate(rows: (typeof calendar.$inferSelect)[]) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const overrideRows = await this.database.query.calendarOccurrenceOverrides.findMany({ where: (table, { inArray }) => inArray(table.calendarId, ids) });
    const interactionRows = await this.database.query.interactions.findMany({ where: (table, { inArray }) => inArray(table.calendarId, ids) });
    return rows.map((row) => mapCalendarEvent(row, overrideRows.filter((item) => item.calendarId === row.id).map(mapOverride),
      interactionRows.filter((item) => item.calendarId === row.id).map(mapInteraction)));
  }

  async listByOwner(ownerUserId: string, range?: { from: Date; to: Date }): Promise<CalendarEventRecord[]> {
    const likelyOverlap = range
      ? or(
        isNull(calendar.firstStartsAt),
        and(sql`${calendar.firstStartsAt} < ${range.to}`, or(isNull(calendar.recurrenceUntil), sql`${calendar.recurrenceUntil} >= ${range.from.toISOString().slice(0, 10)}`)),
      )
      : undefined;
    return this.hydrate(await this.database.select().from(calendar).where(and(
      eq(calendar.ownerUserId, ownerUserId), eq(calendar.status, "ACTIVE"), likelyOverlap,
    )));
  }
  async findById(id: string): Promise<CalendarEventRecord | null> {
    const rows = await this.database.select().from(calendar).where(eq(calendar.id, id)).limit(1);
    return (await this.hydrate(rows))[0] ?? null;
  }
  async listConflictEntries(ownerUserId: string, excludeCalendarId?: string, range?: { from: Date; to?: Date }): Promise<CalendarConflictEntry[]> {
    const to = range?.to ?? new Date("9999-12-31T23:59:59.999Z");
    return (await this.listByOwner(ownerUserId, range ? { from: range.from, to } : undefined))
      .filter((event) => event.id !== excludeCalendarId)
      .map((event) => ({
        id: event.id,
        rule: { anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime, timeZone: event.timeZone,
          durationMinutes: event.durationMinutes, recurrence: event.recurrence,
          ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}), ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) },
        cancelledOccurrenceKeys: event.overrides.filter((item) => item.status === "CANCELLED").map((item) => item.recurrenceKey),
        overrides: Object.fromEntries(event.overrides.map((item) => [item.recurrenceKey, { status: item.status, startsAt: item.startsAt, endsAt: item.endsAt }])),
      }));
  }
  async ensureInteractionsForOccurrences(calendarId: string, recurrenceKeys: string[]): Promise<CalendarInteractionRecord[]> {
    if (!this.transactionScoped) {
      return this.database.transaction((tx) =>
        new DrizzleCalendarRepository(tx, true).ensureInteractionsForOccurrences(calendarId, recurrenceKeys),
      );
    }
    const keys = [...new Set(recurrenceKeys)];
    if (!keys.length) return [];
    const existing = await this.database.select().from(interactions).where(and(
      eq(interactions.calendarId, calendarId), inArray(interactions.recurrenceKey, keys),
    ));
    const missing = keys.filter((key) => !existing.some((row) => row.recurrenceKey === key));
    if (missing.length) {
      const [snapshot] = existing.length ? existing : await this.database.select().from(interactions).where(eq(interactions.calendarId, calendarId)).limit(1);
      if (!snapshot) throw new DatabaseError("materialize calendar occurrence interactions");
      await this.database.insert(interactions).values(missing.map((recurrenceKey) => ({
        calendarId, recurrenceKey, facilityId: snapshot.facilityId, agentUserId: snapshot.agentUserId,
        modality: snapshot.modality,
      }))).onConflictDoNothing({ target: [interactions.calendarId, interactions.recurrenceKey] });
    }
    return (await this.database.select().from(interactions).where(and(
      eq(interactions.calendarId, calendarId), inArray(interactions.recurrenceKey, keys),
    ))).map(mapInteraction);
  }
  async getCommandReceipt<T>(ownerUserId: string, commandKey: string): Promise<T | undefined> {
    const [row] = await this.database.select({ result: calendarCommandReceipts.result }).from(calendarCommandReceipts)
      .where(and(eq(calendarCommandReceipts.ownerUserId, ownerUserId), eq(calendarCommandReceipts.commandKey, commandKey))).limit(1);
    return row?.result as T | undefined;
  }
  async saveCommandReceipt<T>(ownerUserId: string, commandKey: string, commandKind: string, resourceId: string | null, result: T): Promise<T> {
    const [row] = await this.database.insert(calendarCommandReceipts).values({ ownerUserId, commandKey, commandKind, resourceId, result })
      .onConflictDoNothing({ target: [calendarCommandReceipts.ownerUserId, calendarCommandReceipts.commandKey] }).returning({ result: calendarCommandReceipts.result });
    if (row) return row.result as T;
    const replay = await this.getCommandReceipt<T>(ownerUserId, commandKey);
    if (replay === undefined) throw new DatabaseError("save calendar command receipt");
    return replay;
  }
  async create(input: CreateCalendarEventInput): Promise<CalendarEventRecord> {
    const [row] = await this.database.insert(calendar).values(input.event).returning();
    if (!row) throw new DatabaseError("create calendar event");
    let interactionRows: CalendarInteractionRecord[] = [];
    if (input.interaction) {
      const [created] = await this.database.insert(interactions).values({ calendarId: row.id, ...input.interaction }).returning();
      if (!created) throw new DatabaseError("create calendar interaction");
      interactionRows = [mapInteraction(created)];
    }
    return mapCalendarEvent(row, [], interactionRows);
  }
  async update(input: UpdateCalendarEventInput): Promise<CalendarEventRecord | null> {
    const [row] = await this.database.update(calendar).set({ ...input.changes, updatedAt: new Date(), version: sql`${calendar.version} + 1` })
      .where(and(eq(calendar.id, input.id), eq(calendar.version, input.expectedVersion), eq(calendar.status, "ACTIVE"))).returning();
    return row ? this.findById(row.id) : null;
  }
  async upsertOverride(input: UpsertCalendarOverrideInput): Promise<CalendarOverrideRecord | null> {
    const existing = await this.database.select().from(calendarOccurrenceOverrides).where(and(eq(calendarOccurrenceOverrides.calendarId, input.calendarId), eq(calendarOccurrenceOverrides.recurrenceKey, input.recurrenceKey))).limit(1);
    if (!existing[0]) {
      if (input.expectedVersion !== 0) return null;
      const [created] = await this.database.insert(calendarOccurrenceOverrides).values({ calendarId: input.calendarId, recurrenceKey: input.recurrenceKey,
        startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, reason: input.reason ?? null }).returning();
      return created ? mapOverride(created) : null;
    }
    const [updated] = await this.database.update(calendarOccurrenceOverrides).set({ startsAt: input.startsAt, endsAt: input.endsAt,
      status: input.status, reason: input.reason ?? null, version: sql`${calendarOccurrenceOverrides.version} + 1` })
      .where(and(eq(calendarOccurrenceOverrides.id, existing[0].id), eq(calendarOccurrenceOverrides.version, input.expectedVersion))).returning();
    return updated ? mapOverride(updated) : null;
  }
  async deleteInvalidOverrides(calendarId: string, recurrenceKeys: string[]): Promise<boolean> {
    if (!recurrenceKeys.length) return true;
    await this.database.delete(calendarOccurrenceOverrides).where(and(
      eq(calendarOccurrenceOverrides.calendarId, calendarId), inArray(calendarOccurrenceOverrides.recurrenceKey, recurrenceKeys),
    ));
    return true;
  }
  async cancel(input: CancelCalendarEventInput): Promise<CalendarEventRecord | null> {
    const [row] = await this.database.update(calendar).set({ status: "CANCELLED", cancelledAt: new Date(),
      cancelledByUserId: input.actorUserId, cancellationReason: input.reason, updatedAt: new Date(),
      version: sql`${calendar.version} + 1` })
      .where(and(eq(calendar.id, input.id), eq(calendar.version, input.expectedVersion), ne(calendar.status, "CANCELLED"))).returning();
    return row ? this.findById(row.id) : null;
  }
}
