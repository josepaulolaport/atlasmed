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
  /** Spec 0009 R2: set when the rep holds this clinic outside their patch. */
  overrideReason: string | null;
  overrideByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Spec 0009 R2: "how many out-of-territory assignments exist, who, and why". */
export interface OutOfTerritoryAssignment {
  assignmentId: number;
  facilityId: number;
  facilityName: string;
  verticalId: number;
  userId: number;
  userName: string;
  overrideReason: string;
  overrideByUserId: number | null;
  overrideByName: string | null;
  startedAt: Date;
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
    /** Spec 0009 R2: null unless the rep is being given a clinic off-patch. */
    overrideReason?: string | null;
    overrideByUserId?: number | null;
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

  /**
   * Spec 0009 R2's acceptance criterion: overrides are reportable. Active
   * overrides only — an ended one is history, not an exposure.
   */
  findOutOfTerritoryAssignments(params: {
    verticalIds?: number[];
    limit: number;
    offset: number;
  }): Promise<{ rows: OutOfTerritoryAssignment[]; total: number }>;
}
