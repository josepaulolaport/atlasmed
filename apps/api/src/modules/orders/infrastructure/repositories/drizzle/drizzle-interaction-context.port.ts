import { interactions } from "@atlasmed/database";
import { eq } from "drizzle-orm";
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
      })
      .from(interactions)
      .where(eq(interactions.id, interactionId))
      .limit(1);

    if (!interaction) return null;

    return {
      ...interaction,
      canRead: true,
      canCreateOrder: interaction.status === "SCHEDULED" || interaction.status === "IN_PROGRESS",
    };
  }
}
