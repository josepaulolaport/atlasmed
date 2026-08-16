import { calendar, calendarOccurrenceOverrides, interactions } from "@atlasmed/database";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import type { InteractionContextPort } from "../../../application/interfaces/interaction-context.port";

export class DrizzleInteractionContextPort implements InteractionContextPort {
  async findById(interactionId: number) {
    return this.load(db, interactionId, false);
  }

  async lockAndGetOrderable(interactionId: number, database: AnyDatabase = db) {
    return this.load(database, interactionId, true);
  }

  private async load(database: AnyDatabase, interactionId: number, lock: boolean) {
    if (lock) {
      const [owner] = await database
        .select({ ownerUserId: calendar.ownerUserId })
        .from(interactions)
        .innerJoin(calendar, eq(calendar.id, interactions.calendarId))
        .where(eq(interactions.id, interactionId))
        .limit(1);
      if (!owner) return null;
      await database.execute(sql`select pg_advisory_xact_lock(hashtext(${String(owner.ownerUserId)}))`);
    }
    const query = database
      .select({
        id: interactions.id,
        ownerUserId: calendar.ownerUserId,
        agentUserId: interactions.agentUserId,
        facilityId: interactions.facilityId,
        status: interactions.status,
        calendarStatus: calendar.status,
        occurrenceStatus: calendarOccurrenceOverrides.status,
      })
      .from(interactions)
      .innerJoin(calendar, eq(calendar.id, interactions.calendarId))
      .leftJoin(
        calendarOccurrenceOverrides,
        and(
          eq(calendarOccurrenceOverrides.calendarId, interactions.calendarId),
          eq(calendarOccurrenceOverrides.recurrenceKey, interactions.recurrenceKey),
        ),
      )
      .where(eq(interactions.id, interactionId))
      .limit(1);
    const [interaction] = lock
      ? await query.for("update")
      : await query;

    if (!interaction) return null;

    return {
      ...interaction,
      canRead: true,
      canCreateOrder:
        // An order is placed by a clinic. A contact with a doctor that happened
        // nowhere (§15.7.5) has no buyer to attach one to, so it cannot carry
        // an order — the rep records the order against the clinic's own visit.
        interaction.facilityId !== null &&
        interaction.calendarStatus === "ACTIVE" &&
        interaction.occurrenceStatus !== "CANCELLED" &&
        (interaction.status === "SCHEDULED" || interaction.status === "IN_PROGRESS"),
    };
  }
}
