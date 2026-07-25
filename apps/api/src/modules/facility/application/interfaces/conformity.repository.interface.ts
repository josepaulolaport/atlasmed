export type ConformityRecordStatus =
  | "PENDING"
  | "SUBMITTED"
  | "VALIDATED"
  | "REJECTED"
  | "EXPIRED";

export type FacilityTaxIdType = "PF" | "PJ";

export interface ConformityRequirementRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  verticalId: string | null;
  appliesToTaxIdType: FacilityTaxIdType | null;
  isActive: boolean;
  allowedMimeTypes: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  maxCombinedSizeBytes: number;
  requiresFrontAndBack: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConformityRecordRow {
  id: string;
  facilityId: string;
  requirementId: string;
  status: ConformityRecordStatus;
  submittedAt: Date | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  validatedByUserId: string | null;
  storageKey: string | null;
  url: string | null;
  contentType: string | null;
  fileName: string | null;
  reviewerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  requirement: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    appliesToTaxIdType: FacilityTaxIdType | null;
  };
  facility?: {
    id: string;
    name: string;
    taxIdType: FacilityTaxIdType | null;
  };
}

export interface ConformityRepository {
  findActiveRequirements(params?: {
    taxIdType?: FacilityTaxIdType | null;
  }): Promise<ConformityRequirementRecord[]>;

  findRequirementById(id: string): Promise<ConformityRequirementRecord | null>;

  findRecordsByFacility(facilityId: string): Promise<ConformityRecordRow[]>;

  findRecordById(id: string): Promise<ConformityRecordRow | null>;

  findRecordByFacilityAndRequirement(
    facilityId: string,
    requirementId: string
  ): Promise<ConformityRecordRow | null>;

  findRecordByStorageKey(storageKey: string): Promise<ConformityRecordRow | null>;

  findSubmittedRecords(params: {
    status: ConformityRecordStatus;
    page: number;
    limit: number;
  }): Promise<{ records: ConformityRecordRow[]; total: number }>;

  createRecord(params: {
    facilityId: string;
    requirementId: string;
    status?: ConformityRecordStatus;
  }): Promise<ConformityRecordRow>;

  upsertSubmittedRecord(params: {
    facilityId: string;
    requirementId: string;
    storageKey: string;
    url: string;
    contentType: string;
    fileName: string;
  }): Promise<ConformityRecordRow>;

  approveRecord(params: {
    recordId: string;
    validatedByUserId: string;
  }): Promise<ConformityRecordRow>;

  rejectRecord(params: {
    recordId: string;
    validatedByUserId: string;
    reviewerNote: string;
  }): Promise<ConformityRecordRow>;
}
