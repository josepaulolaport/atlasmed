export type InteractionContextStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export interface InteractionContext {
  id: string;
  agentUserId: string;
  facilityId: string;
  status: InteractionContextStatus;
  canRead: boolean;
  canCreateOrder: boolean;
}

export interface InteractionContextPort {
  findById(interactionId: string): Promise<InteractionContext | null>;
}
