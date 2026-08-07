export interface FacilityConsultantAssignmentRecord {
  id: string;
  facilityId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  assignedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityConsultantAssignmentRepository {
  findByFacility(facilityId: string): Promise<FacilityConsultantAssignmentRecord[]>;

  findCurrentByFacility(facilityId: string): Promise<FacilityConsultantAssignmentRecord | null>;

  /** Active (endedAt IS NULL) consultant assignments for a user. */
  findActiveFacilityIdsByUserId(
    userId: string,
    verticalIds?: string[],
  ): Promise<string[]>;

  assign(params: {
    facilityId: string;
    userId: string;
    verticalId: string;
    assignedByUserId: string;
  }): Promise<FacilityConsultantAssignmentRecord>;

  /** End active primary assignments for facilities (Spec 0006 boundary impact). */
  endActiveForFacilities(params: {
    facilityIds: string[];
    endReason: string;
  }): Promise<number>;
}
