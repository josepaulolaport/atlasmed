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



/**
 * When an unfinished visit should be given up on — spec 0016 §15.6.1, §15.6.6-5.
 *
 * The rep's own workday end (§15.5.5), except never before the visit could
 * plausibly have happened: a 19:00 visit against an 18:00 workday would
 * otherwise close *before* it started, and
 * `interactions_actual_ends_after_starts_check` rejects that outright — the job
 * would throw once and stop closing anything for anyone.
 */
export function inferredCloseAt(args: {
  startedAt: Date;
  workdayEndsAt: Date;
  minimumMinutes: number;
}): Date {
  const floor = new Date(args.startedAt.getTime() + args.minimumMinutes * 60_000);
  return args.workdayEndsAt > floor ? args.workdayEndsAt : floor;
}

/**
 * Which of the rep's open visits a new arrival ends — spec 0016 §15.6.1.
 *
 * Pulled out of the query on purpose. The scoping has to hold on **both**
 * sides — an in-person arrival closes in-person visits, a call closes nothing
 * and is closed by nothing (§15.6.6-6) — and a live run against Postgres caught
 * it holding on only one, with a phone call silently ending the visit the rep
 * was still sitting in. That asymmetry is a decision, not a query, so it is
 * testable here rather than only observable against a database.
 */
export function visitsClosedByArrival<
  T extends { modality: string; actualStartedAt: Date | null },
>(args: {
  startingModality: string;
  open: T[];
  at: Date;
}): (T & { actualStartedAt: Date })[] {
  if (args.startingModality !== "IN_PERSON") return [];
  // The narrowed return is the point: a caller cannot forget that everything
  // surviving this filter has a start to measure from.
  return args.open.filter(
    (visit): visit is T & { actualStartedAt: Date } =>
      visit.modality === "IN_PERSON" &&
      // The check constraint requires a positive duration, and clock skew or a
      // start replayed out of order can produce one that is not. Such a visit
      // is left open for the next-morning question rather than closed at a time
      // that would have to be invented (§15.6.6-5).
      visit.actualStartedAt !== null &&
      args.at > visit.actualStartedAt,
  );
}

/**
 * Closes whatever in-person visit the rep left open — spec 0016 §15.6.1.
 *
 * A rep's day is a sequence: arriving somewhere is proof they left the last
 * place. Requiring a second button press to say so is what leaves the whole
 * outcome loop empty, so starting the next visit ends the previous one.
 *
 * **Scoped to `IN_PERSON` on both sides (§15.6.6-6).** The caller only invokes
 * this for an in-person start, and only in-person visits are closed. A phone
 * call taken during a visit neither ends it nor is ended by it — roteirização never proposes calls and
 * only accounts for the time they occupy (§4.4), so at most one in-person visit
 * is open at a time and a remote one carries its own end.
 *
 * The close is `MEASURED`: nobody pressed a button, but the rep's arrival
 * elsewhere is a witnessed fact about the world, not an assumption the engine
 * made. That distinction is the whole of §15.6.2 — an *inferred* end, such as
 * an auto-close at a planned time, would teach the engine its own guess.
 *
 * Runs inside the caller's transaction so a start can never half-happen and
 * leave two visits open.
 */
async function closeOpenVisits(
  tx: AnyDatabase,
  args: { agentUserId: number; exceptId: number; at: Date; startingModality: string },
): Promise<void> {
  const open = await tx
    .select()
    .from(interactions)
    .where(
      and(
        eq(interactions.agentUserId, args.agentUserId),
        eq(interactions.status, "IN_PROGRESS"),
        sql`${interactions.id} <> ${args.exceptId}`,
      ),
    )
    .for("update");

  for (const stale of visitsClosedByArrival({
    startingModality: args.startingModality,
    open,
    at: args.at,
  })) {
    let visitId = stale.visitId;
    if (!visitId) {
      const [visit] = await tx
        .insert(visits)
        .values({
          userId: stale.agentUserId,
          facilityId: stale.facilityId,
          visitedAt: stale.actualStartedAt,
        })
        .returning({ id: visits.id });
      if (!visit) throw new DatabaseError("create compatibility visit");
      visitId = visit.id;
    }

    const [closed] = await tx
      .update(interactions)
      .set({
        status: "COMPLETED",
        actualEndedAt: args.at,
        durationSource: "MEASURED",
        visitId,
        updatedAt: args.at,
        version: sql`${interactions.version} + 1`,
      })
      .where(eq(interactions.id, stale.id))
      .returning();
    if (!closed) continue;

    // SYSTEM, not USER: the rep started something else, they did not ask for
    // this. The event is what makes the close visible when somebody asks why a
    // visit says it lasted forty minutes.
    await tx.insert(interactionEvents).values({
      interactionId: stale.id,
      actorUserId: null,
      source: "SYSTEM",
      previousStatus: "IN_PROGRESS",
      newStatus: "COMPLETED",
      metadata: { source: "closed-by-next-visit", closedAt: args.at.toISOString() },
    });
  }
}

/** Falls back to the linha default when the rep has never set their hours. */
const DEFAULT_WORKDAY_END = "18:00";

/** A visit is never closed shorter than this, whatever the workday says. */
const INFERRED_CLOSE_MINIMUM_MINUTES = 30;

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
      await closeOpenVisits(tx, { agentUserId: updated.agentUserId, exceptId: input.id,
        at: input.startedAt, startingModality: updated.modality });
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
        // §15.6.2 — MEASURED only when both ends were witnessed.
        //
        // A correction reconstructs the start from the schedule, or from a
        // millisecond before the end when even that is missing. Nobody saw it.
        // Labelling that MEASURED would feed the planned length straight back
        // into the median that is supposed to replace the plan — the exact
        // circularity duration_source exists to prevent, arriving through the
        // one path where the numbers look entirely reasonable.
        durationSource: corrected ? ("INFERRED" as const) : ("MEASURED" as const),
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


  /**
   * Closes visits the rep walked away from — spec 0016 §15.6.1.
   *
   * The last visit of a day has no successor to close it, and a
   * single-destination day has none at all. Without this they stay
   * `IN_PROGRESS` forever, and the rep's next visit tomorrow would close
   * yesterday's at a duration that is pure fiction.
   *
   * Closed as **`INFERRED`**, which is the whole point: nobody witnessed this
   * ending, so it must never train the duration model (§15.6.2). Closing at the
   * planned end and calling it measured would teach the engine that visits take
   * exactly as long as it guessed.
   */
  async closeStaleVisits(input: { now: Date; limit: number; actorUserId: number | null }): Promise<number> {
    return this.inTransaction(async (_repository, tx) => {
      const candidates = await tx.execute<{
        id: number;
        agent_user_id: number;
        facility_id: number;
        visit_id: number | null;
        actual_started_at: Date;
        workday_ends_at: Date;
      }>(sql`
        select i.id, i.agent_user_id, i.facility_id, i.visit_id, i.actual_started_at,
               -- The rep's workday end, on the local day the visit started, in
               -- the appointment's own zone rather than the server's.
               ((i.actual_started_at at time zone c.time_zone)::date
                 + coalesce(
                     (u.metadata -> 'preferences' ->> 'workdayEnd')::time,
                     ${DEFAULT_WORKDAY_END}::time))
                 at time zone c.time_zone                             as workday_ends_at
        from interactions i
        join calendar c on c.id = i.calendar_id
        join users u on u.id = i.agent_user_id
        where i.status = 'IN_PROGRESS'
          -- Not restricted to IN_PERSON. Arrival-based closing is, because only
          -- an in-person arrival proves the rep left somewhere (§15.6.6-6) — but
          -- a call has no arrival to close it and no explicit end anybody can be
          -- relied on to press, so without this it stays IN_PROGRESS forever.
          and i.actual_started_at is not null
          -- Cheap prefilter: the close is never earlier than start + the
          -- minimum, so anything newer than that cannot be due yet. Without it
          -- a long tail of freshly-started visits fills the page and crowds out
          -- the ones that actually need closing.
          and i.actual_started_at < now() - make_interval(mins => ${INFERRED_CLOSE_MINIMUM_MINUTES})
        order by i.actual_started_at asc
        limit ${input.limit}
      `);

      let closed = 0;
      for (const row of candidates) {
        const startedAt = new Date(row.actual_started_at);
        const closeAt = inferredCloseAt({
          startedAt,
          workdayEndsAt: new Date(row.workday_ends_at),
          minimumMinutes: INFERRED_CLOSE_MINIMUM_MINUTES,
        });
        if (closeAt > input.now) continue;

        let visitId = row.visit_id;
        if (!visitId) {
          const [visit] = await tx.insert(visits)
            .values({ userId: row.agent_user_id, facilityId: row.facility_id, visitedAt: startedAt })
            .returning({ id: visits.id });
          if (!visit) throw new DatabaseError("create compatibility visit");
          visitId = visit.id;
        }

        const [updated] = await tx.update(interactions).set({
          status: "COMPLETED",
          actualEndedAt: closeAt,
          durationSource: "INFERRED",
          visitId,
          updatedAt: input.now,
          version: sql`${interactions.version} + 1`,
        }).where(and(eq(interactions.id, row.id), eq(interactions.status, "IN_PROGRESS"))).returning({ id: interactions.id });
        if (!updated) continue;

        await tx.insert(interactionEvents).values({
          interactionId: row.id,
          actorUserId: input.actorUserId,
          source: "SYSTEM",
          previousStatus: "IN_PROGRESS",
          newStatus: "COMPLETED",
          metadata: { source: "workday-end-close", closedAt: closeAt.toISOString() },
        });
        closed += 1;
      }
      return closed;
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
