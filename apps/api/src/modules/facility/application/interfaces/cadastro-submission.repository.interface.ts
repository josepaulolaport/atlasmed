import type {
  CadastroDocumentFileRole,
  CadastroDocumentStatus,
  CadastroFileAssetStatus,
  CadastroReviewDecision,
  CadastroUploadSessionStatus,
} from "@atlasmed/database";

/**
 * A cadastro document — the unit of the pipeline (ADR 0007). There is no
 * package record above it.
 */
export interface SubmissionDocumentRecord {
  id: number;
  facilityId: number;
  /** NULL = facility-scoped: satisfies this requirement for every linha. */
  facilityVerticalProfileId: number | null;
  requirementId: number;
  title: string;
  status: CadastroDocumentStatus;
  version: number;
  reviewComment: string | null;
  submittedByUserId: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requirement?: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    appliesToLegalDocumentType: "CNPJ" | "CPF" | null;
    allowedMimeTypes: string[];
    maxFiles: number;
    maxFileSizeBytes: number;
    maxCombinedSizeBytes: number;
    requiresFrontAndBack: boolean;
  };
}

export interface FileAssetRecord {
  id: number;
  facilityId: number;
  storageProvider: string;
  bucket: string;
  objectKey: string;
  thumbObjectKey: string | null;
  previewObjectKey: string | null;
  originalFilename: string;
  declaredMimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  sha256: string | null;
  status: CadastroFileAssetStatus;
  pageCount: number | null;
  width: number | null;
  height: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  uploadedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFileRecord {
  id: number;
  submissionDocumentId: number;
  fileAssetId: number;
  position: number;
  role: CadastroDocumentFileRole;
  createdAt: Date;
  fileAsset?: FileAssetRecord;
}

export interface UploadSessionRecord {
  id: number;
  fileAssetId: number;
  storageUploadId: string;
  status: CadastroUploadSessionStatus;
  partSize: number;
  expiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CadastroSubmissionRepository {
  findDocumentById(id: number): Promise<SubmissionDocumentRecord | null>;
  /**
   * The document a rep is currently working on for this requirement: the
   * highest version that has not been closed out. Null when the requirement has
   * never been touched, or when every attempt is finished (APPROVED/REJECTED/
   * SUPERSEDED) and the next upload should open a new version.
   */
  findWorkingDocument(input: {
    facilityId: number;
    requirementId: number;
  }): Promise<SubmissionDocumentRecord | null>;
  /** All versions for a facility+requirement, newest first. */
  listDocumentsForFacilityRequirement(input: {
    facilityId: number;
    requirementId: number;
    excludeDraft?: boolean;
  }): Promise<SubmissionDocumentRecord[]>;
  /**
   * Ops review queue: documents across facilities by document status.
   *
   * `facilityIds` restricts the queue to what the reviewer may see. Omitting it
   * means unrestricted, which only a global scope may ask for. An empty array
   * is a real restriction — see nothing — never a shorthand for everything.
   */
  listDocumentsForReview(input: {
    status: CadastroDocumentStatus[];
    facilityIds?: number[];
    page: number;
    limit: number;
  }): Promise<{
    items: Array<{
      document: SubmissionDocumentRecord;
      facilityId: number;
      submittedByName: string | null;
    }>;
    total: number;
  }>;
  createDocument(input: {
    facilityId: number;
    facilityVerticalProfileId: number | null;
    requirementId: number;
    title: string;
    version?: number;
  }): Promise<SubmissionDocumentRecord>;
  deleteDocument(id: number): Promise<void>;
  updateDocumentStatus(input: {
    id: number;
    status: CadastroDocumentStatus;
    reviewComment?: string | null;
    version?: number;
    submittedAt?: Date | null;
    submittedByUserId?: number | null;
  }): Promise<SubmissionDocumentRecord>;

  createFileAsset(input: {
    id?: number;
    facilityId: number;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256?: string | null;
    status?: CadastroFileAssetStatus;
  }): Promise<FileAssetRecord>;
  findFileAssetById(id: number): Promise<FileAssetRecord | null>;
  deleteFileAsset(id: number): Promise<void>;
  updateFileAsset(input: {
    id: number;
    status?: CadastroFileAssetStatus;
    sha256?: string | null;
    detectedMimeType?: string | null;
    pageCount?: number | null;
    width?: number | null;
    height?: number | null;
    thumbObjectKey?: string | null;
    previewObjectKey?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    uploadedAt?: Date | null;
    processedAt?: Date | null;
  }): Promise<FileAssetRecord>;

  /**
   * Adds one file to a document atomically: limit checks, position allocation,
   * the `file_assets` row and the `document_files` link, all under a lock on
   * the parent document (D-15, spec 0011 §4.4).
   *
   * Every part of this used to be a separate read-then-write. Two uploads to
   * one document read the same count, the same total size and the same next
   * position, so `maxFiles` and `maxCombinedSizeBytes` were both bypassable and
   * the loser hit a raw unique violation on `document_files_document_position_uidx`
   * — surfacing as a 500.
   *
   * Worse, the `file_assets` row was inserted *before* the link, so the loser
   * left an asset with no `document_files` row: invisible to the checklist,
   * invisible to the prune, and holding bytes nobody could reach. Doing both
   * inserts in one transaction makes that orphan unrepresentable rather than
   * something to clean up afterwards.
   *
   * Limits come from the caller because they live on the requirement, and the
   * verdict is returned rather than thrown so the decision about which HTTP
   * error to raise stays in the use case.
   */
  attachFileToDocument(input: {
    documentId: number;
    facilityId: number;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256?: string | null;
    role: CadastroDocumentFileRole;
    position?: number;
    maxFiles: number;
    maxCombinedSizeBytes: number;
  }): Promise<
    | { outcome: "attached"; asset: FileAssetRecord; position: number }
    | { outcome: "document_missing" }
    | { outcome: "max_files_exceeded" }
    | { outcome: "max_combined_size_exceeded" }
  >;

  listDocumentFiles(documentId: number): Promise<DocumentFileRecord[]>;
  findDocumentFileByFileAssetId(
    fileAssetId: number
  ): Promise<DocumentFileRecord | null>;
  createDocumentFile(input: {
    submissionDocumentId: number;
    fileAssetId: number;
    position: number;
    role: CadastroDocumentFileRole;
  }): Promise<DocumentFileRecord>;
  /** Removes the document↔file link, then the file asset row. */
  deleteDocumentFileByFileAssetId(fileAssetId: number): Promise<void>;
  reorderDocumentFiles(input: {
    submissionDocumentId: number;
    ordered: Array<{ fileAssetId: number; position: number; role: CadastroDocumentFileRole }>;
  }): Promise<DocumentFileRecord[]>;
  sumDocumentFileSizes(documentId: number): Promise<number>;
  countDocumentFiles(documentId: number): Promise<number>;
  /** Next free 1-based position (max existing + 1). Safe after mid-list deletes. */
  nextDocumentFilePosition(documentId: number): Promise<number>;

  createUploadSession(input: {
    fileAssetId: number;
    storageUploadId: string;
    partSize: number;
    expiresAt: Date;
  }): Promise<UploadSessionRecord>;
  findUploadSessionById(id: number): Promise<UploadSessionRecord | null>;
  updateUploadSession(input: {
    id: number;
    status: CadastroUploadSessionStatus;
    completedAt?: Date | null;
  }): Promise<UploadSessionRecord>;
  upsertUploadPart(input: {
    uploadSessionId: number;
    partNumber: number;
    etag: string;
    sizeBytes?: number;
  }): Promise<void>;

  createReviewDecision(input: {
    submissionDocumentId: number;
    reviewerId: number;
    decision: CadastroReviewDecision;
    reasonCode?: string | null;
    comment?: string | null;
    documentVersion: number;
    flaggedFileAssetIds?: number[];
  }): Promise<void>;

  createProcessingEvent(input: {
    fileAssetId: number;
    processingStep: string;
    status: "STARTED" | "SUCCEEDED" | "FAILED";
    errorCode?: string | null;
    errorMessage?: string | null;
    attempt?: number;
  }): Promise<void>;
}
