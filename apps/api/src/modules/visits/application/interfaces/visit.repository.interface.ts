export interface VisitRecord {
  id: string
  userId: string
  facilityId: string
  visitedAt: Date
  createdAt: Date
}

export interface VisitRepository {
  create(input: { userId: string; facilityId: string; visitedAt: Date }): Promise<VisitRecord>
  countDistinctFacilitiesForUserInPeriod(input: {
    userId: string
    start: Date
    end: Date
    facilityIds?: string[]
  }): Promise<number>
  countFacilities(input: { facilityIds?: string[] }): Promise<number>
}
