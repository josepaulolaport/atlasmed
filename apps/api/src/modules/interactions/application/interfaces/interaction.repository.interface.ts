export interface InteractionRecord {
  id: string;
  type: "followup" | "presentation";
  summary: string;
  userId: string;
  facilityId: string;
  interactedAt: Date;
  createdAt: Date;
}

export interface InteractionRepository {
  create(input: {
    type: "followup" | "presentation";
    summary: string;
    userId: string;
    facilityId: string;
    interactedAt: Date;
  }): Promise<InteractionRecord>;
  countDistinctFacilitiesForUserInPeriod(input: {
    userId: string;
    start: Date;
    end: Date;
    facilityIds?: string[];
  }): Promise<number>;
  countFacilities(input: { facilityIds?: string[] }): Promise<number>;
}
