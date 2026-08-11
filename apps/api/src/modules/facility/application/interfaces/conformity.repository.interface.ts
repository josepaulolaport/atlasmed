import type { FacilityLegalDocumentType } from "@atlasmed/database";

export type ConformityRecordStatus =
  | "PENDING"
  | "SUBMITTED"
  | "VALIDATED"
  | "REJECTED"
  | "EXPIRED";

export type { FacilityLegalDocumentType };

export interface ConformityRequirementRecord {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  verticalId: number | null;
  appliesToLegalDocumentType: FacilityLegalDocumentType | null;
  isActive: boolean;
  allowedMimeTypes: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  maxCombinedSizeBytes: number;
  requiresFrontAndBack: boolean;
  requiresValidityDate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConformityRecordRow {
  id: number;
  facilityId: number;
  requirementId: number;
  status: ConformityRecordStatus;
  submittedAt: Date | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  validatedByUserId: number | null;
  storageKey: string | null;
  url: string | null;
  contentType: string | null;
  fileName: string | null;
  reviewerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  requirement: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    appliesToLegalDocumentType: FacilityLegalDocumentType | null;
  };
  facility?: {
    id: number;
    name: string;
    legalDocumentType: FacilityLegalDocumentType | null;
  };
}

export interface ConformityRepository {
  findActiveRequirements(params?: {
    legalDocumentType?: FacilityLegalDocumentType | null;
    /**
     * Restrict to this vertical's requirements plus the facility-scoped ones
     * (null vertical_id). Omitted means the whole active catalogue — correct
     * for admin listings, wrong for a clinic's checklist (D-49).
     */
    verticalId?: number | null;
  }): Promise<ConformityRequirementRecord[]>;

  findRequirementById(id: number): Promise<ConformityRequirementRecord | null>;

  findRecordsByFacility(facilityId: number): Promise<ConformityRecordRow[]>;

  findRecordById(id: number): Promise<ConformityRecordRow | null>;

  findRecordByFacilityAndRequirement(
    facilityId: number,
    requirementId: number
  ): Promise<ConformityRecordRow | null>;

  findRecordByStorageKey(storageKey: string): Promise<ConformityRecordRow | null>;

  findSubmittedRecords(params: {
    status: ConformityRecordStatus;
    page: number;
    limit: number;
  }): Promise<{ records: ConformityRecordRow[]; total: number }>;

  createRecord(params: {
    facilityId: number;
    requirementId: number;
    status?: ConformityRecordStatus;
  }): Promise<ConformityRecordRow>;

  upsertSubmittedRecord(params: {
    facilityId: number;
    requirementId: number;
    storageKey: string;
    url: string;
    contentType: string;
    fileName: string;
  }): Promise<ConformityRecordRow>;

  approveRecord(params: {
    recordId: number;
    validatedByUserId: number;
  }): Promise<ConformityRecordRow>;

  rejectRecord(params: {
    recordId: number;
    validatedByUserId: number;
    reviewerNote: string;
  }): Promise<ConformityRecordRow>;
}
