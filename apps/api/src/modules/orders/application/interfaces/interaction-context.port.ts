import type { AnyDatabase } from "@atlasmed/database";

export type InteractionContextStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export interface InteractionContext {
  id: number;
  ownerUserId: number;
  agentUserId: number;
  /**
   * Null for a contact that happened nowhere (§15.7.5). An order is placed by a
   * clinic, so `canCreateOrder` is false for one — see the port implementation.
   */
  facilityId: number | null;
  status: InteractionContextStatus;
  calendarStatus: "ACTIVE" | "CANCELLED";
  occurrenceStatus: "ACTIVE" | "CANCELLED" | null;
  canRead: boolean;
  canCreateOrder: boolean;
}

export interface InteractionContextPort {
  findById(interactionId: number): Promise<InteractionContext | null>;
  /** Re-read interaction/calendar/override state while holding the shared owner lock. */
  lockAndGetOrderable(interactionId: number, database?: AnyDatabase): Promise<InteractionContext | null>;
}
