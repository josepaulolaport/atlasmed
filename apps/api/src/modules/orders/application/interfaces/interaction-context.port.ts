import type { AnyDatabase } from "@atlasmed/database";

export type InteractionContextStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export interface InteractionContext {
  id: string;
  ownerUserId: string;
  agentUserId: string;
  facilityId: string;
  status: InteractionContextStatus;
  calendarStatus: "ACTIVE" | "CANCELLED";
  occurrenceStatus: "ACTIVE" | "CANCELLED" | null;
  canRead: boolean;
  canCreateOrder: boolean;
}

export interface InteractionContextPort {
  findById(interactionId: string): Promise<InteractionContext | null>;
  /** Re-read interaction/calendar/override state while holding the shared owner lock. */
  lockAndGetOrderable(interactionId: string, database?: AnyDatabase): Promise<InteractionContext | null>;
}
