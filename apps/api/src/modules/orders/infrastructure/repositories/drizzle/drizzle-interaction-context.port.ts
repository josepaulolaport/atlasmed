import { calendar, calendarOccurrenceOverrides, interactions } from "@atlasmed/database";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import type { InteractionContextPort } from "../../../application/interfaces/interaction-context.port";

export class DrizzleInteractionContextPort implements InteractionContextPort {
  async findById(interactionId: string) {
    return this.load(db, interactionId, false);
  }

  async lockAndGetOrderable(interactionId: string, database: AnyDatabase = db) {
    return this.load(database, interactionId, true);
  }

  private async load(database: AnyDatabase, interactionId: string, lock: boolean) {
    if (lock) {
      const [owner] = await database
        .select({ ownerUserId: calendar.ownerUserId })
        .from(interactions)
        .innerJoin(calendar, eq(calendar.id, interactions.calendarId))
        .where(eq(interactions.id, interactionId))
        .limit(1);
      if (!owner) return null;
      await database.execute(sql`select pg_advisory_xact_lock(hashtext(${owner.ownerUserId}))`);
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
        interaction.calendarStatus === "ACTIVE" &&
        interaction.occurrenceStatus !== "CANCELLED" &&
        (interaction.status === "SCHEDULED" || interaction.status === "IN_PROGRESS"),
    };
  }
}
