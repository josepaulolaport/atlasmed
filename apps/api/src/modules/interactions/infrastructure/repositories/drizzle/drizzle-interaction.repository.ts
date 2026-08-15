import {
  calendar,
  calendarOccurrenceOverrides,
  facilities,
  interactionEvents,
  interactions,
  municipalities,
  orders,
  states,
  users,
  visits,
  type AnyDatabase,
} from "@atlasmed/database";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { DatabaseError } from "../../../../../shared/errors";
import { calendarOccurrenceFromRecurrenceKey } from "../../../../calendar/application/services/recurrence.service";
import type {
  InteractionDetailRecord,
  InteractionMutationResult,
  InteractionRepository,
} from "../../../application/interfaces/interaction.repository.interface";

type InteractionRow = typeof interactions.$inferSelect;
type CalendarRow = typeof calendar.$inferSelect;

function commandMetadata(command: "start" | "complete", idempotencyKey: string, resultVersion: number) {
  return { command, idempotencyKey, resultVersion };
}

function isCommandEvent(metadata: Record<string, unknown>, command: string, idempotencyKey: string) {
  return metadata.command === command && metadata.idempotencyKey === idempotencyKey;
}

export async function collectOverdueCandidates<T extends { interaction: { id: number; updatedAt: Date } }>(input: {
  limit: number;
  pageSize: number;
  fetchPage(cursor: { updatedAt: Date; id: number } | null): Promise<T[]>;
  isOverdue(candidate: T): boolean;
}): Promise<T[]> {
  const overdue: T[] = [];
  let cursor: { updatedAt: Date; id: number } | null = null;
  while (overdue.length < input.limit) {
    const candidates = await input.fetchPage(cursor);
    for (const candidate of candidates) {
      if (input.isOverdue(candidate)) overdue.push(candidate);
      if (overdue.length === input.limit) break;
    }
    const last = candidates.at(-1)?.interaction;
    if (!last || candidates.length < input.pageSize) break;
    cursor = { updatedAt: last.updatedAt, id: last.id };
  }
  return overdue;
}

export class DrizzleInteractionRepository implements InteractionRepository {
  constructor(private readonly database: AnyDatabase = db) {}

  async findById(id: number): Promise<InteractionDetailRecord | null> {
    const [row] = await this.database
      .select({
        interaction: interactions,
        calendar,
        facility: facilities,
        facilityCity: municipalities.name,
        facilityState: states.abbreviation,
        agent: users,
      })
      .from(interactions)
      .innerJoin(calendar, eq(calendar.id, interactions.calendarId))
      .innerJoin(facilities, eq(facilities.id, interactions.facilityId))
      .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
      .innerJoin(states, eq(states.id, facilities.stateId))
      .innerJoin(users, eq(users.id, interactions.agentUserId))
      .where(eq(interactions.id, id))
      .limit(1);
    if (!row) return null;

    const [override, orderRows] = await Promise.all([
      this.database.select().from(calendarOccurrenceOverrides).where(and(
        eq(calendarOccurrenceOverrides.calendarId, row.interaction.calendarId),
        eq(calendarOccurrenceOverrides.recurrenceKey, row.interaction.recurrenceKey),
      )).limit(1),
      this.database.select({ id: orders.id, status: orders.status, type: orders.type, orderedAt: orders.orderedAt })
        .from(orders).where(eq(orders.interactionId, id)).orderBy(asc(orders.orderedAt)),
    ]);
    return this.mapDetail(
      row.interaction,
      row.calendar,
      row.facility,
      { city: row.facilityCity, state: row.facilityState },
      row.agent,
      override[0] ?? null,
      orderRows,
    );
  }

  async findCommandResult(input: { id: number; command: "start" | "complete"; idempotencyKey: string }) {
    const events = await this.database.select({ metadata: interactionEvents.metadata }).from(interactionEvents)
      .where(eq(interactionEvents.interactionId, input.id));
    if (!events.some((event) => isCommandEvent(event.metadata, input.command, input.idempotencyKey))) return null;
    return this.findById(input.id);
  }

  async start(input: { id: number; actorUserId: number; expectedVersion: number; idempotencyKey: string; startedAt: Date }): Promise<InteractionMutationResult | null> {
    return this.inTransaction(async (repository, tx) => {
      const replay = await repository.findCommandResult({ id: input.id, command: "start", idempotencyKey: input.idempotencyKey });
      if (replay) return { interaction: replay, replayed: true };
      const [context] = await tx.select({ calendarStatus: calendar.status, overrideStatus: calendarOccurrenceOverrides.status })
        .from(interactions).innerJoin(calendar, eq(calendar.id, interactions.calendarId))
        .leftJoin(calendarOccurrenceOverrides, and(eq(calendarOccurrenceOverrides.calendarId, interactions.calendarId),
          eq(calendarOccurrenceOverrides.recurrenceKey, interactions.recurrenceKey)))
        .where(eq(interactions.id, input.id)).limit(1);
      if (!context || context.calendarStatus === "CANCELLED" || context.overrideStatus === "CANCELLED") return null;
      const [updated] = await tx.update(interactions).set({ status: "IN_PROGRESS", actualStartedAt: input.startedAt,
        updatedAt: input.startedAt, version: sql`${interactions.version} + 1` }).where(and(eq(interactions.id, input.id),
          eq(interactions.status, "SCHEDULED"), eq(interactions.version, input.expectedVersion))).returning();
      if (!updated) {
        const concurrentReplay = await repository.findCommandResult({ id: input.id, command: "start", idempotencyKey: input.idempotencyKey });
        return concurrentReplay ? { interaction: concurrentReplay, replayed: true } : null;
      }
      await tx.insert(interactionEvents).values({ interactionId: input.id, actorUserId: input.actorUserId, source: "USER",
        previousStatus: "SCHEDULED", newStatus: "IN_PROGRESS", metadata: commandMetadata("start", input.idempotencyKey, updated.version) });
      const detail = await repository.findById(input.id);
      if (!detail) throw new DatabaseError("load started interaction");
      return { interaction: detail, replayed: false };
    });
  }

  async complete(input: { id: number; actorUserId: number; expectedVersion: number; idempotencyKey: string; completedAt: Date; scheduledStartsAt?: Date; correctionReason?: string; persistEffectiveMissed?: boolean }): Promise<InteractionMutationResult | null> {
    return this.inTransaction(async (repository, tx) => {
      const replay = await repository.findCommandResult({ id: input.id, command: "complete", idempotencyKey: input.idempotencyKey });
      if (replay) return { interaction: replay, replayed: true };
      const [current] = await tx.select().from(interactions).where(eq(interactions.id, input.id)).for("update").limit(1);
      if (!current || current.version !== input.expectedVersion
        || (!["IN_PROGRESS", "NOT_COMPLETED"].includes(current.status) && !(input.persistEffectiveMissed && current.status === "SCHEDULED"))) return null;

      const persistedMissed = input.persistEffectiveMissed === true && current.status === "SCHEDULED";
      const corrected = current.status === "NOT_COMPLETED" || persistedMissed;
      const actualStartedAt = corrected
        ? input.scheduledStartsAt ?? new Date(input.completedAt.getTime() - 1)
        : current.actualStartedAt;
      if (!actualStartedAt || input.completedAt <= actualStartedAt) return null;
      let visitId = current.visitId;
      if (!visitId) {
        const [visit] = await tx.insert(visits).values({ userId: current.agentUserId, facilityId: current.facilityId,
          visitedAt: actualStartedAt }).returning({ id: visits.id });
        if (!visit) throw new DatabaseError("create compatibility visit");
        visitId = visit.id;
      }
      if (persistedMissed) {
        await tx.insert(interactionEvents).values({ interactionId: input.id, actorUserId: null, source: "SYSTEM",
          previousStatus: "SCHEDULED", newStatus: "NOT_COMPLETED", metadata: { source: "completion-correction" } });
      }
      const [updated] = await tx.update(interactions).set({
        status: "COMPLETED",
        actualStartedAt,
        // The rep pressed the button, so somebody saw this end (§15.6.2).
        // Everything that closes a visit without a witness must set INFERRED.
        durationSource: "MEASURED" as const,
        actualEndedAt: input.completedAt,
        correctedAt: corrected ? input.completedAt : null,
        correctedByUserId: corrected ? input.actorUserId : null,
        correctionReason: corrected ? input.correctionReason ?? null : null,
        visitId,
        updatedAt: input.completedAt,
        version: sql`${interactions.version} + 1`,
      }).where(and(eq(interactions.id, input.id), eq(interactions.version, input.expectedVersion))).returning();
      if (!updated) return null;
      await tx.insert(interactionEvents).values({ interactionId: input.id, actorUserId: input.actorUserId, source: "USER",
        previousStatus: persistedMissed ? "NOT_COMPLETED" : current.status, newStatus: "COMPLETED", reason: corrected ? input.correctionReason : null,
        metadata: commandMetadata("complete", input.idempotencyKey, updated.version) });
      const detail = await repository.findById(input.id);
      if (!detail) throw new DatabaseError("load completed interaction");
      return { interaction: detail, replayed: false };
    });
  }

  async markOverdue(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number> {
    return this.inTransaction(async (_repository, tx) => {
      const pageSize = Math.max(input.limit * 4, 100);
      const overdue = await collectOverdueCandidates<{
        interaction: InteractionRow;
        calendar: CalendarRow;
        override: typeof calendarOccurrenceOverrides.$inferSelect | null;
      }>({
        limit: input.limit,
        pageSize,
        fetchPage: async (cursor) => {
          const cursorCondition: ReturnType<typeof or> = cursor
            ? or(gt(interactions.updatedAt, cursor.updatedAt),
              and(eq(interactions.updatedAt, cursor.updatedAt), gt(interactions.id, cursor.id)))
            : undefined;
          return tx.select({ interaction: interactions, calendar, override: calendarOccurrenceOverrides })
            .from(interactions).innerJoin(calendar, eq(calendar.id, interactions.calendarId))
            .leftJoin(calendarOccurrenceOverrides, and(eq(calendarOccurrenceOverrides.calendarId, interactions.calendarId),
              eq(calendarOccurrenceOverrides.recurrenceKey, interactions.recurrenceKey)))
            .where(and(eq(interactions.status, "SCHEDULED"), eq(calendar.status, "ACTIVE"), cursorCondition))
            .orderBy(asc(interactions.updatedAt), asc(interactions.id)).limit(pageSize);
        },
        isOverdue: ({ interaction, calendar: event, override }) => {
          if (override?.status === "CANCELLED") return false;
          if (override) return override.endsAt <= input.now;
          const occurrence = calendarOccurrenceFromRecurrenceKey({ anchorLocalDate: event.anchorLocalDate,
            anchorLocalTime: event.anchorLocalTime.slice(0, 5), timeZone: event.timeZone, durationMinutes: event.durationMinutes,
            recurrence: event.recurrence, ...(event.recurrenceUntil ? { recurrenceUntil: event.recurrenceUntil } : {}),
            ...(event.recurrenceCount ? { recurrenceCount: event.recurrenceCount } : {}) }, interaction.recurrenceKey);
          return !!occurrence && occurrence.endsAt <= input.now;
        },
      });
      if (!overdue.length) return 0;
      const ids = overdue.map(({ interaction }) => interaction.id);
      const updated = await tx.update(interactions).set({ status: "NOT_COMPLETED", updatedAt: input.now,
        version: sql`${interactions.version} + 1` }).where(and(inArray(interactions.id, ids), eq(interactions.status, "SCHEDULED"))).returning({ id: interactions.id });
      const updatedIds = new Set(updated.map((row) => row.id));
      const eventRows = overdue.filter(({ interaction }) => updatedIds.has(interaction.id)).map(({ interaction }) => ({
        interactionId: interaction.id,
        actorUserId: input.actorUserId,
        source: "SYSTEM" as const,
        previousStatus: "SCHEDULED" as const,
        newStatus: "NOT_COMPLETED" as const,
        metadata: { source: "overdue-job" },
      }));
      if (eventRows.length) await tx.insert(interactionEvents).values(eventRows);
      return eventRows.length;
    });
  }

  private async inTransaction<T>(work: (repository: DrizzleInteractionRepository, database: AnyDatabase) => Promise<T>): Promise<T> {
    if ("transaction" in this.database) {
      return this.database.transaction(async (tx) => work(new DrizzleInteractionRepository(tx), tx));
    }
    return work(this, this.database);
  }

  private mapDetail(
    row: InteractionRow,
    event: CalendarRow,
    facility: typeof facilities.$inferSelect,
    facilityGeo: { city: string | null; state: string | null },
    agent: typeof users.$inferSelect,
    override: typeof calendarOccurrenceOverrides.$inferSelect | null,
    linkedOrders: Array<{ id: number; status: string; type: string; orderedAt: Date }>,
  ): InteractionDetailRecord {
    return {
      ...row,
      calendar: { ownerUserId: event.ownerUserId, title: event.title, anchorLocalDate: event.anchorLocalDate,
        anchorLocalTime: event.anchorLocalTime.slice(0, 5), timeZone: event.timeZone, durationMinutes: event.durationMinutes,
        recurrence: event.recurrence, recurrenceUntil: event.recurrenceUntil, recurrenceCount: event.recurrenceCount,
        status: event.status, version: event.version },
      occurrenceOverride: override ? { startsAt: override.startsAt, endsAt: override.endsAt, status: override.status, version: override.version } : null,
      facility: {
        id: facility.id,
        displayName: facility.displayName,
        city: facilityGeo.city,
        state: facilityGeo.state,
      },
      agent: { id: agent.id, firstName: agent.firstName, lastName: agent.lastName },
      linkedOrders,
    };
  }
}
