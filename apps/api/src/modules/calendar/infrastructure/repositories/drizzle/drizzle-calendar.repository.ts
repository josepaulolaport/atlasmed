import { and, eq, sql } from "drizzle-orm";
import { calendar, calendarOccurrenceOverrides, interactions, type AnyDatabase } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import type {
  CalendarEventRecord,
  CalendarInteractionRecord,
  CalendarOverrideRecord,
  CalendarRepository,
  CreateCalendarEventInput,
  DeleteCalendarEventInput,
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
function mapEvent(row: typeof calendar.$inferSelect, overrides: CalendarOverrideRecord[], interactionRows: CalendarInteractionRecord[]): CalendarEventRecord {
  return { id: row.id, ownerUserId: row.ownerUserId, kind: row.kind, title: row.title,
    anchorLocalDate: row.anchorLocalDate, anchorLocalTime: row.anchorLocalTime.slice(0, 5), timeZone: row.timeZone,
    durationMinutes: row.durationMinutes, firstStartsAt: row.firstStartsAt, firstEndsAt: row.firstEndsAt,
    recurrence: row.recurrence, recurrenceUntil: row.recurrenceUntil, recurrenceCount: row.recurrenceCount,
    version: row.version, overrides, interactions: interactionRows };
}

export class DrizzleCalendarRepository implements CalendarRepository {
  constructor(private readonly database: AnyDatabase = db) {}

  async runWithOwnerLock<T>(ownerUserId: string, work: (repository: CalendarRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.database) {
      return this.database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerUserId}))`);
        return work(new DrizzleCalendarRepository(tx));
      });
    }
    return work(this);
  }

  private async hydrate(rows: (typeof calendar.$inferSelect)[]) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const overrideRows = await this.database.query.calendarOccurrenceOverrides.findMany({ where: (table, { inArray }) => inArray(table.calendarId, ids) });
    const interactionRows = await this.database.query.interactions.findMany({ where: (table, { inArray }) => inArray(table.calendarId, ids) });
    return rows.map((row) => mapEvent(row, overrideRows.filter((item) => item.calendarId === row.id).map(mapOverride),
      interactionRows.filter((item) => item.calendarId === row.id).map(mapInteraction)));
  }

  async listByOwner(ownerUserId: string): Promise<CalendarEventRecord[]> {
    return this.hydrate(await this.database.select().from(calendar).where(eq(calendar.ownerUserId, ownerUserId)));
  }
  async findById(id: string): Promise<CalendarEventRecord | null> {
    const rows = await this.database.select().from(calendar).where(eq(calendar.id, id)).limit(1);
    return (await this.hydrate(rows))[0] ?? null;
  }
  async listConflictEntries(ownerUserId: string, excludeCalendarId?: string): Promise<CalendarConflictEntry[]> {
    return (await this.listByOwner(ownerUserId)).filter((event) => event.id !== excludeCalendarId).map((event) => ({
      id: event.id,
      rule: { anchorLocalDate: event.anchorLocalDate, anchorLocalTime: event.anchorLocalTime, timeZone: event.timeZone,
        durationMinutes: event.durationMinutes, recurrence: event.recurrence,
        ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}), ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) },
      cancelledOccurrenceKeys: event.overrides.filter((item) => item.status === "CANCELLED").map((item) => item.recurrenceKey),
      overrides: Object.fromEntries(event.overrides.map((item) => [item.recurrenceKey, { status: item.status, startsAt: item.startsAt, endsAt: item.endsAt }])),
    }));
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
    return mapEvent(row, [], interactionRows);
  }
  async update(input: UpdateCalendarEventInput): Promise<CalendarEventRecord | null> {
    const [row] = await this.database.update(calendar).set({ ...input.changes, updatedAt: new Date(), version: sql`${calendar.version} + 1` })
      .where(and(eq(calendar.id, input.id), eq(calendar.version, input.expectedVersion))).returning();
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
  async delete(input: DeleteCalendarEventInput): Promise<boolean> {
    const rows = await this.database.delete(calendar).where(and(eq(calendar.id, input.id), eq(calendar.version, input.expectedVersion))).returning({ id: calendar.id });
    return rows.length === 1;
  }
}
