import type {
  CadastroDocumentFileRole,
  CadastroDocumentStatus,
  CadastroFileAssetStatus,
  CadastroReviewDecision,
  CadastroSubmissionStatus,
  CadastroUploadSessionStatus,
} from "@atlasmed/database";

export interface CadastroSubmissionRecord {
  id: string;
  facilityId: string;
  verticalId: string | null;
  submittedByUserId: string | null;
  status: CadastroSubmissionStatus;
  version: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionDocumentRecord {
  id: string;
  submissionId: string;
  requirementId: string;
  title: string;
  status: CadastroDocumentStatus;
  version: number;
  reviewComment: string | null;
  createdAt: Date;
  updatedAt: Date;
  requirement?: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    appliesToTaxIdType: "PF" | "PJ" | null;
    allowedMimeTypes: string[];
    maxFiles: number;
    maxFileSizeBytes: number;
    maxCombinedSizeBytes: number;
    requiresFrontAndBack: boolean;
  };
}

export interface FileAssetRecord {
  id: string;
  facilityId: string;
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
  id: string;
  submissionDocumentId: string;
  fileAssetId: string;
  position: number;
  role: CadastroDocumentFileRole;
  createdAt: Date;
  fileAsset?: FileAssetRecord;
}

export interface UploadSessionRecord {
  id: string;
  fileAssetId: string;
  storageUploadId: string;
  status: CadastroUploadSessionStatus;
  partSize: number;
  expiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CadastroSubmissionRepository {
  findDraftByFacility(facilityId: string): Promise<CadastroSubmissionRecord | null>;
  findById(id: string): Promise<CadastroSubmissionRecord | null>;
  findLatestByFacility(facilityId: string): Promise<CadastroSubmissionRecord | null>;
  createSubmission(input: {
    facilityId: string;
    verticalId: string;
    submittedByUserId?: string | null;
    version: number;
  }): Promise<CadastroSubmissionRecord>;
  updateSubmissionStatus(input: {
    id: string;
    status: CadastroSubmissionStatus;
    submittedAt?: Date | null;
    submittedByUserId?: string | null;
  }): Promise<CadastroSubmissionRecord>;
  deleteSubmission(id: string): Promise<void>;
  listSubmissions(input: {
    status?: CadastroSubmissionStatus[];
    page: number;
    limit: number;
  }): Promise<{ items: CadastroSubmissionRecord[]; total: number }>;

  findDocumentById(id: string): Promise<SubmissionDocumentRecord | null>;
  findDocumentsBySubmission(submissionId: string): Promise<SubmissionDocumentRecord[]>;
  findDocumentBySubmissionAndRequirement(
    submissionId: string,
    requirementId: string
  ): Promise<SubmissionDocumentRecord | null>;
  /** Documents for a facility+requirement, newest package first. */
  listDocumentsForFacilityRequirement(input: {
    facilityId: string;
    requirementId: string;
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
    }>;
    total: number;
  }>;
  createDocument(input: {
    submissionId: string;
    requirementId: string;
    title: string;
  }): Promise<SubmissionDocumentRecord>;
  updateDocumentStatus(input: {
    id: string;
    status: CadastroDocumentStatus;
    reviewComment?: string | null;
    version?: number;
  }): Promise<SubmissionDocumentRecord>;

  createFileAsset(input: {
    id?: string;
    facilityId: string;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256?: string | null;
    status?: CadastroFileAssetStatus;
  }): Promise<FileAssetRecord>;
  findFileAssetById(id: string): Promise<FileAssetRecord | null>;
  deleteFileAsset(id: string): Promise<void>;
  updateFileAsset(input: {
    id: string;
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

  listDocumentFiles(documentId: string): Promise<DocumentFileRecord[]>;
  findDocumentFileByFileAssetId(
    fileAssetId: string
  ): Promise<DocumentFileRecord | null>;
  createDocumentFile(input: {
    submissionDocumentId: string;
    fileAssetId: string;
    position: number;
    role: CadastroDocumentFileRole;
  }): Promise<DocumentFileRecord>;
  reorderDocumentFiles(input: {
    submissionDocumentId: string;
    ordered: Array<{ fileAssetId: string; position: number; role: CadastroDocumentFileRole }>;
  }): Promise<DocumentFileRecord[]>;
  sumDocumentFileSizes(documentId: string): Promise<number>;
  countDocumentFiles(documentId: string): Promise<number>;

  createUploadSession(input: {
    fileAssetId: string;
    storageUploadId: string;
    partSize: number;
    expiresAt: Date;
  }): Promise<UploadSessionRecord>;
  findUploadSessionById(id: string): Promise<UploadSessionRecord | null>;
  updateUploadSession(input: {
    id: string;
    status: CadastroUploadSessionStatus;
    completedAt?: Date | null;
  }): Promise<UploadSessionRecord>;
  upsertUploadPart(input: {
    uploadSessionId: string;
    partNumber: number;
    etag: string;
    sizeBytes?: number;
  }): Promise<void>;

  createReviewDecision(input: {
    submissionDocumentId: string;
    reviewerId: string;
    decision: CadastroReviewDecision;
    reasonCode?: string | null;
    comment?: string | null;
    documentVersion: number;
    flaggedFileAssetIds?: string[];
  }): Promise<void>;

  createProcessingEvent(input: {
    fileAssetId: string;
    processingStep: string;
    status: "STARTED" | "SUCCEEDED" | "FAILED";
    errorCode?: string | null;
    errorMessage?: string | null;
    attempt?: number;
  }): Promise<void>;
}
