export interface FacilityVerticalRepAssignmentRecord {
  id: number;
  facilityVerticalProfileId: number;
  facilityId: number;
  verticalId: number;
  userId: number;
  startedAt: Date;
  endedAt: Date | null;
  assignedByUserId: number | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityVerticalRepAssignmentRepository {
  findByFacilityVertical(
    facilityId: number,
    verticalId: number,
  ): Promise<FacilityVerticalRepAssignmentRecord[]>;

  findCurrentByFacilityVertical(
    facilityId: number,
    verticalId: number,
  ): Promise<FacilityVerticalRepAssignmentRecord | null>;

  /** Active (endedAt IS NULL) rep assignments for a user → facility ids. */
  findActiveFacilityIdsByUserId(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]>;

  /**
   * Upsert active profile for (facility, vertical), then assign/replace REP.
   * Idempotent when the same user is already active.
   */
  assign(params: {
    facilityId: number;
    verticalId: number;
    userId: number;
    assignedByUserId: number;
  }): Promise<{
    assignment: FacilityVerticalRepAssignmentRecord;
    previousUserId: number | null;
    wasIdempotent: boolean;
  }>;

  /** End active assign only; profile untouched. Idempotent if none. */
  endActive(params: {
    facilityId: number;
    verticalId: number;
    endReason: string;
  }): Promise<{ endedUserId: number | null }>;

  /** End active assigns for profiles (Spec 0006 boundary impact). */
  endActiveForProfiles(params: {
    facilityVerticalProfileIds: number[];
    endReason: string;
  }): Promise<number>;

  /**
   * Soft-deactivate profile: end active assign + `is_active=false`.
   * Idempotent if profile missing/inactive with no active assign.
   */
  deactivateVertical(params: {
    facilityId: number;
    verticalId: number;
  }): Promise<{
    profileId: number | null;
    endedUserId: number | null;
  }>;
}
