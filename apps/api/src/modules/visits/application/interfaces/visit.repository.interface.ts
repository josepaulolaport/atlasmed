export interface VisitRecord {
  id: number;
  userId: number;
  facilityId: number;
  visitedAt: Date;
  createdAt: Date;
}

export interface VisitRepository {
  create(input: { userId: number; facilityId: number; visitedAt: Date }): Promise<VisitRecord>;
  countDistinctFacilitiesForUserInPeriod(input: {
    userId: number;
    start: Date;
    end: Date;
    facilityIds?: number[];
  }): Promise<number>;
  countFacilities(input: { facilityIds?: number[] }): Promise<number>;
}
