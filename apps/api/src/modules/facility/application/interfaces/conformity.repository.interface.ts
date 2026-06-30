export interface ConformityRequirementRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sectorId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConformityRecordRow {
  id: string;
  facilityId: string;
  requirementId: string;
  status: "PENDING" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "EXPIRED";
  submittedAt: Date | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  validatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  requirement: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface ConformityRepository {
  findActiveRequirements(): Promise<ConformityRequirementRecord[]>;

  findRecordsByFacility(facilityId: string): Promise<ConformityRecordRow[]>;

  createRecord(params: {
    facilityId: string;
    requirementId: string;
    status?: ConformityRecordRow["status"];
  }): Promise<ConformityRecordRow>;
}
