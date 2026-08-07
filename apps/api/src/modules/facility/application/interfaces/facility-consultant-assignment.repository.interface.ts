export interface FacilityConsultantAssignmentRecord {
  id: number;
  facilityId: number;
  userId: number;
  startedAt: Date;
  endedAt: Date | null;
  assignedByUserId: number | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityConsultantAssignmentRepository {
  findByFacility(facilityId: number): Promise<FacilityConsultantAssignmentRecord[]>;

  findCurrentByFacility(facilityId: number): Promise<FacilityConsultantAssignmentRecord | null>;

  /** Active (endedAt IS NULL) consultant assignments for a user. */
  findActiveFacilityIdsByUserId(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]>;

  assign(params: {
    facilityId: number;
    userId: number;
    verticalId: number;
    assignedByUserId: number;
  }): Promise<FacilityConsultantAssignmentRecord>;

  /** End active primary assignments for facilities (Spec 0006 boundary impact). */
  endActiveForFacilities(params: {
    facilityIds: number[];
    endReason: string;
  }): Promise<number>;
}
