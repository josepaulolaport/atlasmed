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
  /**
   * What already points at this requirement (spec 0016 §6.2).
   *
   * Populated only by `findAllRequirements` — the admin read — so the form can
   * disable delete with a reason instead of offering it and discovering the
   * refusal afterwards. Undefined on the checklist reads, which have no use for
   * it and should not pay for the counts.
   */
  references?: ConformityRequirementReferences;
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

/**
 * The columns an admin sets on a requirement (spec 0016 §4.7).
 *
 * `slug` is absent: it is chosen once, at creation. It is the requirement's
 * stable key — it travels in every cadastro DTO the mobile app reads — and
 * renaming it would silently orphan anything that had learned it. `name` is the
 * label to change instead.
 */
export interface ConformityRequirementWritableFields {
  name: string;
  description: string | null;
  /** Null means every Linha. */
  verticalId: number | null;
  /** Null means every clinic, CNPJ or CPF. */
  appliesToLegalDocumentType: FacilityLegalDocumentType | null;
  isActive: boolean;
  allowedMimeTypes: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  maxCombinedSizeBytes: number;
  requiresFrontAndBack: boolean;
  requiresValidityDate: boolean;
}

/** What still points at a requirement. Empty ⇒ it can be deleted. */
export type ConformityRequirementReferences = {
  conformityRecords?: number;
  submissionDocuments?: number;
};

export type ConformityRequirementDeletionOutcome =
  | { found: false }
  | { found: true; deleted: true }
  | {
      found: true;
      deleted: false;
      references: ConformityRequirementReferences;
    };

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

  /**
   * The whole catalogue, active and inactive — the admin list (spec 0016 §4).
   *
   * Separate from `findActiveRequirements` rather than a flag on it: that one
   * builds a *clinic's checklist*, and a retired requirement leaking into it
   * would ask a rep for a document nobody wants any more.
   */
  findAllRequirements(): Promise<ConformityRequirementRecord[]>;

  createRequirement(
    data: ConformityRequirementWritableFields & { slug: string }
  ): Promise<ConformityRequirementRecord>;

  updateRequirement(
    id: number,
    data: Partial<ConformityRequirementWritableFields>
  ): Promise<ConformityRequirementRecord | null>;

  /**
   * Deletes a requirement, but only while no clinic has answered it.
   *
   * Both referencing foreign keys are `ON DELETE RESTRICT`, so the alternative
   * is a bare 23503 the admin cannot act on. Same rule and same reasons as the
   * catalogue deletes in spec 0016 §6.2 — retirement is `isActive = false`.
   */
  deleteRequirementIfUnanswered(
    id: number
  ): Promise<ConformityRequirementDeletionOutcome>;

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
