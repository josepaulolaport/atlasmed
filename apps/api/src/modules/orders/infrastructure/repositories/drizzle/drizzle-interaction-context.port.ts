import { calendar, calendarOccurrenceOverrides, interactions } from "@atlasmed/database";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type { InteractionContextPort } from "../../../application/interfaces/interaction-context.port";

export class DrizzleInteractionContextPort implements InteractionContextPort {
  async findById(interactionId: string) {
    const [interaction] = await db
      .select({
        id: interactions.id,
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
