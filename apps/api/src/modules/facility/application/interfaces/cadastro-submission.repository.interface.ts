import type {
  CadastroDocumentFileRole,
  CadastroDocumentStatus,
  CadastroFileAssetStatus,
  CadastroReviewDecision,
  CadastroSubmissionStatus,
  CadastroUploadSessionStatus,
} from "@atlasmed/database";

export interface CadastroSubmissionRecord {
  id: number;
  facilityId: number;
  verticalId: number | null;
  submittedByUserId: number | null;
  status: CadastroSubmissionStatus;
  version: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionDocumentRecord {
  id: number;
  submissionId: number;
  requirementId: number;
  title: string;
  status: CadastroDocumentStatus;
  version: number;
  reviewComment: string | null;
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
  findDraftByFacility(facilityId: number): Promise<CadastroSubmissionRecord | null>;
  findById(id: number): Promise<CadastroSubmissionRecord | null>;
  findLatestByFacility(facilityId: number): Promise<CadastroSubmissionRecord | null>;
  createSubmission(input: {
    facilityId: number;
    verticalId: number;
    submittedByUserId?: number | null;
    version: number;
  }): Promise<CadastroSubmissionRecord>;
  updateSubmissionStatus(input: {
    id: number;
    status: CadastroSubmissionStatus;
    submittedAt?: Date | null;
    submittedByUserId?: number | null;
  }): Promise<CadastroSubmissionRecord>;
  deleteSubmission(id: number): Promise<void>;
  listSubmissions(input: {
    status?: CadastroSubmissionStatus[];
    page: number;
    limit: number;
  }): Promise<{ items: CadastroSubmissionRecord[]; total: number }>;

  findDocumentById(id: number): Promise<SubmissionDocumentRecord | null>;
  findDocumentsBySubmission(submissionId: number): Promise<SubmissionDocumentRecord[]>;
  findDocumentBySubmissionAndRequirement(
    submissionId: number,
    requirementId: number
  ): Promise<SubmissionDocumentRecord | null>;
  /** Documents for a facility+requirement, newest package first. */
  listDocumentsForFacilityRequirement(input: {
    facilityId: number;
    requirementId: number;
    excludeDraft?: boolean;
  }): Promise<
    Array<{
      document: SubmissionDocumentRecord;
      submission: CadastroSubmissionRecord;
    }>
  >;
  /** Ops review queue: documents across facilities by document status. */
  listDocumentsForReview(input: {
    status: CadastroDocumentStatus[];
    page: number;
    limit: number;
  }): Promise<{
    items: Array<{
      document: SubmissionDocumentRecord;
      submission: CadastroSubmissionRecord;
      submittedByName: string | null;
    }>;
    total: number;
  }>;
  createDocument(input: {
    submissionId: number;
    requirementId: number;
    title: string;
  }): Promise<SubmissionDocumentRecord>;
  updateDocumentStatus(input: {
    id: number;
    status: CadastroDocumentStatus;
    reviewComment?: string | null;
    version?: number;
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
