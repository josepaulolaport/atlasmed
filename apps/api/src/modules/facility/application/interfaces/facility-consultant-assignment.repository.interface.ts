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
  findActiveFacilityIdsByUserId(userId: string): Promise<string[]>;

  assign(params: {
    facilityId: string;
    userId: string;
    assignedByUserId: string;
  }): Promise<FacilityConsultantAssignmentRecord>;
}
