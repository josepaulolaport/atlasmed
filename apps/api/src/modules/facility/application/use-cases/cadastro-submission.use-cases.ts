import { randomUUID } from "node:crypto";
import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { CadastroDocumentFileRole } from "@atlasmed/database";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { storageService } from "../../../../infrastructure/storage/storage.service";
import { startCadastroFileUploadedWorkflow } from "../../../../infrastructure/temporal/temporal.client";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { CadastroSubmissionRepository } from "../interfaces/cadastro-submission.repository.interface";
import { FacilityCadastroCompletionService } from "../services/facility-cadastro-completion.service";
import { resolveCadastroVerticalId } from "../utils/cadastro-vertical-inference.utils";
import { resolveFacilityTaxIdType } from "../utils/facility-tax-id.utils";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
const UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

const INCOMPLETE_UPLOAD_STATUSES = new Set(["PENDING_UPLOAD", "UPLOADING"]);

/**
 * Drop abandoned initiate→PUT attempts that never finished.
 * Those ghosts block submit ("Aguarde o processamento…") even when later
 * uploads succeeded (e.g. after a storage outage).
 */
async function pruneIncompleteDocumentUploads(
  repo: CadastroSubmissionRepository,
  documentId: string
) {
  const files = await repo.listDocumentFiles(documentId);
  for (const file of files) {
    const status = file.fileAsset?.status;
    if (!status || !INCOMPLETE_UPLOAD_STATUSES.has(status)) continue;
    await repo.deleteDocumentFileByFileAssetId(file.fileAssetId);
  }
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  conformityRepository: ConformityRepository;
  cadastroRepository: CadastroSubmissionRepository;
  completionService: FacilityCadastroCompletionService;
  storage?: Pick<typeof storageService, "headObject" | "completeMultipartUpload">;
  startCadastroFileUploadedWorkflow?: typeof startCadastroFileUploadedWorkflow;
}

function serializeFile(file: {
  id: string;
  position: number;
  role: string;
  fileAsset?: {
    id: string;
    originalFilename: string;
    declaredMimeType: string;
    detectedMimeType: string | null;
    sizeBytes: number;
    status: string;
    objectKey: string;
    thumbObjectKey: string | null;
    previewObjectKey: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    pageCount: number | null;
  };
}) {
  const asset = file.fileAsset;
  return {
    id: file.id,
    fileAssetId: asset?.id ?? file.id,
    position: file.position,
    role: file.role,
    fileName: asset?.originalFilename,
    contentType: asset?.detectedMimeType ?? asset?.declaredMimeType,
    sizeBytes: asset?.sizeBytes,
    status: asset?.status,
    pageCount: asset?.pageCount ?? undefined,
    errorCode: asset?.errorCode ?? undefined,
    errorMessage: asset?.errorMessage ?? undefined,
    objectKey: asset?.objectKey,
  };
}

async function serializeDocument(
  repo: CadastroSubmissionRepository,
  documentId: string
) {
  const document = await repo.findDocumentById(documentId);
  if (!document) return null;
  const files = await repo.listDocumentFiles(documentId);
  return {
    id: document.id,
    submissionId: document.submissionId,
    requirementId: document.requirementId,
    title: document.title,
    status: document.status,
    version: document.version,
    reviewComment: document.reviewComment ?? undefined,
    requirement: document.requirement
      ? {
          id: document.requirement.id,
          slug: document.requirement.slug,
          name: document.requirement.name,
          description: document.requirement.description ?? undefined,
          appliesToTaxIdType: document.requirement.appliesToTaxIdType ?? undefined,
          allowedMimeTypes: document.requirement.allowedMimeTypes,
          maxFiles: document.requirement.maxFiles,
          maxFileSizeBytes: document.requirement.maxFileSizeBytes,
          maxCombinedSizeBytes: document.requirement.maxCombinedSizeBytes,
          requiresFrontAndBack: document.requirement.requiresFrontAndBack,
        }
      : undefined,
    files: files.map(serializeFile),
  };
}

export class EnsureDraftCadastroSubmissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    scope: ScopeContext;
    verticalId?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    let draft = await this.deps.cadastroRepository.findDraftByFacility(
      input.facilityId
    );
    if (!draft) {
      const verticalId = await resolveCadastroVerticalId({
        facilityId: input.facilityId,
        assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
        facilityRepository: this.deps.facilityRepository,
        verticalId: input.verticalId,
      });
      const latest = await this.deps.cadastroRepository.findLatestByFacility(
        input.facilityId
      );
      draft = await this.deps.cadastroRepository.createSubmission({
        facilityId: input.facilityId,
        verticalId,
        submittedByUserId: input.userId,
        version: (latest?.version ?? 0) + 1,
      });
    }

    const documents = await this.deps.cadastroRepository.findDocumentsBySubmission(
      draft.id
    );
    const serializedDocs = await Promise.all(
      documents.map((d) => serializeDocument(this.deps.cadastroRepository, d.id))
    );

    return {
      id: draft.id,
      facilityId: draft.facilityId,
      status: draft.status,
      version: draft.version,
      submittedAt: draft.submittedAt?.toISOString(),
      documents: serializedDocs.filter(Boolean),
    };
  }
}

export class CreateCadastroSubmissionDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    submissionId: string;
    requirementId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const submission = await this.deps.cadastroRepository.findById(
      input.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("CadastroSubmission", input.submissionId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ForbiddenError();
    }

    const requirement = await this.deps.conformityRepository.findRequirementById(
      input.requirementId
    );
    if (!requirement || !requirement.isActive) {
      throw new ResourceNotFoundError("ConformityRequirement", input.requirementId);
    }

    const existing =
      await this.deps.cadastroRepository.findDocumentBySubmissionAndRequirement(
        input.submissionId,
        input.requirementId
      );
    if (existing) {
      return serializeDocument(this.deps.cadastroRepository, existing.id);
    }

    const document = await this.deps.cadastroRepository.createDocument({
      submissionId: input.submissionId,
      requirementId: input.requirementId,
      title: requirement.name,
    });
    return serializeDocument(this.deps.cadastroRepository, document.id);
  }
}

export class InitiateCadastroFileUploadUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    documentId: string;
    scope: ScopeContext;
    filename: string;
    contentType: string;
    sizeBytes: number;
    checksum?: string;
    role?: CadastroDocumentFileRole;
    position?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    if (!storageService.isConfigured()) {
      throw new ValidationError([
        { field: "storage", message: "Object storage is not configured" },
      ]);
    }

    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    const submission = await this.deps.cadastroRepository.findById(
      document.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ForbiddenError();
    }

    const req = document.requirement;
    if (!req) {
      throw new ResourceNotFoundError("ConformityRequirement", document.requirementId);
    }

    const mime = input.contentType.toLowerCase().trim();
    if (!req.allowedMimeTypes.map((m) => m.toLowerCase()).includes(mime)) {
      throw new ValidationError([
        { field: "contentType", message: `Tipo não permitido: ${mime}` },
      ]);
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > req.maxFileSizeBytes) {
      throw new ValidationError([
        {
          field: "sizeBytes",
          message: `Arquivo deve ter entre 1 e ${req.maxFileSizeBytes} bytes`,
        },
      ]);
    }

    const currentCount = await this.deps.cadastroRepository.countDocumentFiles(
      document.id
    );
    if (currentCount >= req.maxFiles) {
      throw new ValidationError([
        { field: "files", message: `Máximo de ${req.maxFiles} arquivos` },
      ]);
    }

    const currentSize = await this.deps.cadastroRepository.sumDocumentFileSizes(
      document.id
    );
    if (currentSize + input.sizeBytes > req.maxCombinedSizeBytes) {
      throw new ValidationError([
        {
          field: "sizeBytes",
          message: "Tamanho combinado dos arquivos excede o limite",
        },
      ]);
    }

    const fileId = randomUUID();
    const objectKey = `facilities/${input.facilityId}/submissions/${submission.id}/documents/${document.id}/files/${fileId}/original`;

    const asset = await this.deps.cadastroRepository.createFileAsset({
      id: fileId,
      facilityId: input.facilityId,
      bucket: storageService.bucket(),
      objectKey,
      originalFilename: input.filename,
      declaredMimeType: mime,
      sizeBytes: input.sizeBytes,
      sha256: input.checksum ?? null,
      status: "PENDING_UPLOAD",
    });

    const position =
      input.position ??
      (await this.deps.cadastroRepository.nextDocumentFilePosition(document.id));
    const role = input.role ?? "PAGE";

    await this.deps.cadastroRepository.createDocumentFile({
      submissionDocumentId: document.id,
      fileAssetId: asset.id,
      position,
      role,
    });

    const useMultipart = input.sizeBytes > DEFAULT_PART_SIZE;
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);

    if (!useMultipart) {
      const uploadUrl = await storageService.signedPutUrl(objectKey, mime, 3600);
      await this.deps.cadastroRepository.updateFileAsset({
        id: asset.id,
        status: "UPLOADING",
      });
      return {
        fileId: asset.id,
        method: "PUT" as const,
        uploadUrl,
        objectKey,
        partSizeBytes: input.sizeBytes,
        totalParts: 1,
        uploadSessionId: null as string | null,
      };
    }

    const { uploadId } = await storageService.createMultipartUpload(
      objectKey,
      mime
    );
    const session = await this.deps.cadastroRepository.createUploadSession({
      fileAssetId: asset.id,
      storageUploadId: uploadId,
      partSize: DEFAULT_PART_SIZE,
      expiresAt,
    });
    await this.deps.cadastroRepository.updateFileAsset({
      id: asset.id,
      status: "UPLOADING",
    });

    const totalParts = Math.ceil(input.sizeBytes / DEFAULT_PART_SIZE);
    return {
      fileId: asset.id,
      method: "MULTIPART" as const,
      uploadUrl: null as string | null,
      objectKey,
      uploadSessionId: session.id,
      storageUploadId: uploadId,
      partSizeBytes: DEFAULT_PART_SIZE,
      totalParts,
      expiresAt: expiresAt.toISOString(),
    };
  }
}

export class SignCadastroUploadPartsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    uploadSessionId: string;
    partNumbers: number[];
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const session = await this.deps.cadastroRepository.findUploadSessionById(
      input.uploadSessionId
    );
    if (!session) {
      throw new ResourceNotFoundError("UploadSession", input.uploadSessionId);
    }
    const asset = await this.deps.cadastroRepository.findFileAssetById(
      session.fileAssetId
    );
    if (!asset || asset.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("UploadSession", input.uploadSessionId);
    }

    const parts = await Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        uploadUrl: await storageService.signedUploadPartUrl(
          asset.objectKey,
          session.storageUploadId,
          partNumber
        ),
      }))
    );

    await this.deps.cadastroRepository.updateUploadSession({
      id: session.id,
      status: "IN_PROGRESS",
    });

    return { uploadSessionId: session.id, parts };
  }
}

export class CompleteCadastroFileUploadUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    uploadSessionId?: string | null;
    fileId: string;
    scope: ScopeContext;
    parts?: Array<{ partNumber: number; etag: string; sizeBytes?: number }>;
    checksum?: string;
  }) {
    const storage = this.deps.storage ?? storageService;
    const startWorkflow =
      this.deps.startCadastroFileUploadedWorkflow ?? startCadastroFileUploadedWorkflow;

    assertResourceInScope(input.scope, "facility", input.facilityId);
    const asset = await this.deps.cadastroRepository.findFileAssetById(
      input.fileId
    );
    if (!asset || asset.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("FileAsset", input.fileId);
    }

    if (input.uploadSessionId) {
      const session = await this.deps.cadastroRepository.findUploadSessionById(
        input.uploadSessionId
      );
      if (!session || session.fileAssetId !== asset.id) {
        throw new ResourceNotFoundError("UploadSession", input.uploadSessionId);
      }
      if (!input.parts?.length) {
        throw new ValidationError([
          { field: "parts", message: "Parts são obrigatórias para multipart" },
        ]);
      }
      for (const part of input.parts) {
        await this.deps.cadastroRepository.upsertUploadPart({
          uploadSessionId: session.id,
          partNumber: part.partNumber,
          etag: part.etag,
          sizeBytes: part.sizeBytes,
        });
      }
      await storage.completeMultipartUpload(
        asset.objectKey,
        session.storageUploadId,
        input.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
      );
      await this.deps.cadastroRepository.updateUploadSession({
        id: session.id,
        status: "COMPLETED",
        completedAt: new Date(),
      });
    } else {
      const head = await storage.headObject(asset.objectKey);
      if (!head.exists) {
        throw new ValidationError([
          { field: "fileId", message: "Upload não encontrado no storage" },
        ]);
      }
    }

    await this.deps.cadastroRepository.updateFileAsset({
      id: asset.id,
      status: "PROCESSING",
      sha256: input.checksum ?? asset.sha256,
      uploadedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });

    try {
      const started = await startWorkflow({
        fileAssetId: asset.id,
        bucket: asset.bucket,
        objectKey: asset.objectKey,
      });

      return {
        fileId: asset.id,
        status: "PROCESSING" as const,
        workflowId: started.workflowId,
      };
    } catch (error) {
      await this.deps.cadastroRepository.updateFileAsset({
        id: asset.id,
        status: "UPLOADED",
        errorCode: "PROCESSING_NOT_SCHEDULED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export class ReorderCadastroDocumentFilesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    documentId: string;
    scope: ScopeContext;
    ordered: Array<{
      fileAssetId: string;
      position: number;
      role: CadastroDocumentFileRole;
    }>;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    const submission = await this.deps.cadastroRepository.findById(
      document.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ForbiddenError();
    }

    await this.deps.cadastroRepository.reorderDocumentFiles({
      submissionDocumentId: document.id,
      ordered: input.ordered,
    });
    return serializeDocument(this.deps.cadastroRepository, document.id);
  }
}

export class GetCadastroFileSignedUrlUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    fileAssetId: string;
    scope: ScopeContext;
    variant?: "original" | "thumb" | "preview";
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const asset = await this.deps.cadastroRepository.findFileAssetById(
      input.fileAssetId
    );
    if (!asset || asset.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("FileAsset", input.fileAssetId);
    }
    const key =
      input.variant === "thumb"
        ? asset.thumbObjectKey ?? asset.objectKey
        : input.variant === "preview"
          ? asset.previewObjectKey ?? asset.objectKey
          : asset.objectKey;
    const url = await storageService.signedGetUrl(key, 900);
    return { url, expiresInSeconds: 900, fileAssetId: asset.id };
  }
}

export class DeleteDraftCadastroSubmissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    submissionId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const submission = await this.deps.cadastroRepository.findById(
      input.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("CadastroSubmission", input.submissionId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ValidationError([
        {
          field: "submissionId",
          message: "Somente rascunhos podem ser excluídos",
        },
      ]);
    }

    const documents =
      await this.deps.cadastroRepository.findDocumentsBySubmission(submission.id);
    const assetIds: string[] = [];
    for (const doc of documents) {
      const files = await this.deps.cadastroRepository.listDocumentFiles(doc.id);
      for (const file of files) {
        assetIds.push(file.fileAssetId);
      }
    }

    // Collect assets before cascade removes document_files links.
    const assets = await Promise.all(
      assetIds.map((id) => this.deps.cadastroRepository.findFileAssetById(id))
    );

    await this.deps.cadastroRepository.deleteSubmission(submission.id);

    for (const asset of assets) {
      if (!asset) continue;
      try {
        await storageService.delete(asset.objectKey);
        if (asset.thumbObjectKey) await storageService.delete(asset.thumbObjectKey);
        if (asset.previewObjectKey) {
          await storageService.delete(asset.previewObjectKey);
        }
      } catch {
        // Best-effort storage cleanup.
      }
      try {
        await this.deps.cadastroRepository.deleteFileAsset(asset.id);
      } catch {
        // Ignore if already removed.
      }
    }

    return { deleted: true, submissionId: submission.id };
  }
}

export class SubmitCadastroSubmissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    submissionId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const submission = await this.deps.cadastroRepository.findById(
      input.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("CadastroSubmission", input.submissionId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ForbiddenError();
    }

    const taxIdType = resolveFacilityTaxIdType(facility);
    const requirements =
      await this.deps.conformityRepository.findActiveRequirements({ taxIdType });
    const documents =
      await this.deps.cadastroRepository.findDocumentsBySubmission(submission.id);

    const issues: Array<{ field: string; message: string }> = [];
    for (const req of requirements) {
      const doc = documents.find((d) => d.requirementId === req.id);
      if (!doc) {
        issues.push({
          field: req.slug,
          message: `Documento obrigatório ausente: ${req.name}`,
        });
        continue;
      }
      await pruneIncompleteDocumentUploads(
        this.deps.cadastroRepository,
        doc.id
      );
      const files = await this.deps.cadastroRepository.listDocumentFiles(doc.id);
      if (files.length === 0) {
        issues.push({
          field: req.slug,
          message: `Nenhum arquivo em: ${req.name}`,
        });
        continue;
      }
      const notReady = files.filter((f) => f.fileAsset?.status !== "READY");
      if (notReady.length > 0) {
        issues.push({
          field: req.slug,
          message: `Arquivos ainda não prontos em: ${req.name}`,
        });
      }
      if (req.requiresFrontAndBack) {
        const roles = new Set(files.map((f) => f.role));
        if (!roles.has("FRONT") || !roles.has("BACK")) {
          issues.push({
            field: req.slug,
            message: `${req.name} exige frente e verso`,
          });
        }
      }
    }

    if (issues.length > 0) throw new ValidationError(issues);

    for (const doc of documents) {
      await this.deps.cadastroRepository.updateDocumentStatus({
        id: doc.id,
        status: "UNDER_REVIEW",
      });
    }

    const updated = await this.deps.cadastroRepository.updateSubmissionStatus({
      id: submission.id,
      status: "UNDER_REVIEW",
      submittedAt: new Date(),
      submittedByUserId: input.userId,
    });

    return {
      id: updated.id,
      status: updated.status,
      version: updated.version,
      submittedAt: updated.submittedAt?.toISOString(),
    };
  }
}

export class ReviewCadastroDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    documentId: string;
    userId: string;
    scope: ScopeContext;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    comment?: string;
    reasonCode?: string;
    flaggedFileAssetIds?: string[];
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    const submission = await this.deps.cadastroRepository.findById(
      document.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    if (submission.status !== "UNDER_REVIEW") {
      throw new ForbiddenError();
    }

    await this.deps.cadastroRepository.createReviewDecision({
      submissionDocumentId: document.id,
      reviewerId: input.userId,
      decision: input.decision,
      reasonCode: input.reasonCode ?? null,
      comment: input.comment ?? null,
      documentVersion: document.version,
      flaggedFileAssetIds: input.flaggedFileAssetIds,
    });

    await this.deps.cadastroRepository.updateDocumentStatus({
      id: document.id,
      status: input.decision,
      reviewComment: input.comment ?? null,
    });

    const allDocs =
      await this.deps.cadastroRepository.findDocumentsBySubmission(submission.id);

    if (input.decision === "CHANGES_REQUESTED") {
      await this.deps.cadastroRepository.updateSubmissionStatus({
        id: submission.id,
        status: "SUPERSEDED",
      });
      const next = await this.deps.cadastroRepository.createSubmission({
        facilityId: input.facilityId,
        verticalId:
          submission.verticalId ??
          (await resolveCadastroVerticalId({
            facilityId: input.facilityId,
            assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
            facilityRepository: this.deps.facilityRepository,
          })),
        submittedByUserId: submission.submittedByUserId,
        version: submission.version + 1,
      });
      // Clone non-flagged ready docs as APPROVED/READY into new draft for correction.
      for (const doc of allDocs) {
        const cloned = await this.deps.cadastroRepository.createDocument({
          submissionId: next.id,
          requirementId: doc.requirementId,
          title: doc.title,
        });
        if (doc.id === document.id) {
          await this.deps.cadastroRepository.updateDocumentStatus({
            id: cloned.id,
            status: "CHANGES_REQUESTED",
            reviewComment: input.comment ?? null,
            version: doc.version + 1,
          });
        } else if (doc.status === "APPROVED") {
          await this.deps.cadastroRepository.updateDocumentStatus({
            id: cloned.id,
            status: "APPROVED",
            version: doc.version,
          });
          const files = await this.deps.cadastroRepository.listDocumentFiles(doc.id);
          for (const file of files) {
            await this.deps.cadastroRepository.createDocumentFile({
              submissionDocumentId: cloned.id,
              fileAssetId: file.fileAssetId,
              position: file.position,
              role: file.role,
            });
          }
        } else {
          await this.deps.cadastroRepository.updateDocumentStatus({
            id: cloned.id,
            status: "DRAFT",
            version: doc.version,
          });
        }
      }
      return {
        documentId: document.id,
        decision: input.decision,
        nextSubmissionId: next.id,
        nextVersion: next.version,
      };
    }

    const statuses = (
      await this.deps.cadastroRepository.findDocumentsBySubmission(submission.id)
    ).map((d) => d.status);

    if (statuses.every((s) => s === "APPROVED")) {
      await this.deps.cadastroRepository.updateSubmissionStatus({
        id: submission.id,
        status: "APPROVED",
      });
      await this.deps.completionService.evaluateAndApply(
        input.facilityId,
        submission.verticalId ??
          (await resolveCadastroVerticalId({
            facilityId: input.facilityId,
            assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
            facilityRepository: this.deps.facilityRepository,
          })),
      );
    } else if (statuses.some((s) => s === "REJECTED") && statuses.every((s) => s === "APPROVED" || s === "REJECTED")) {
      await this.deps.cadastroRepository.updateSubmissionStatus({
        id: submission.id,
        status: "REJECTED",
      });
    }

    return {
      documentId: document.id,
      decision: input.decision,
    };
  }
}

export class ListCadastroPackageSubmissionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    status?: Array<"UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED">;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);
    const result = await this.deps.cadastroRepository.listSubmissions({
      status: input.status ?? ["UNDER_REVIEW"],
      page,
      limit,
    });

    const items = await Promise.all(
      result.items.map(async (submission) => {
        const facility = await this.deps.facilityRepository.findById(
          submission.facilityId
        );
        const documents =
          await this.deps.cadastroRepository.findDocumentsBySubmission(
            submission.id
          );
        return {
          id: submission.id,
          facilityId: submission.facilityId,
          facilityName: facility?.name,
          status: submission.status,
          version: submission.version,
          submittedAt: submission.submittedAt?.toISOString(),
          documentCount: documents.length,
        };
      })
    );

    return { items, total: result.total, page, limit };
  }
}

export class ListCadastroRequirementSubmissionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    requirementId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const rows =
      await this.deps.cadastroRepository.listDocumentsForFacilityRequirement({
        facilityId: input.facilityId,
        requirementId: input.requirementId,
        excludeDraft: true,
      });

    const items = await Promise.all(
      rows.map(async ({ document, submission }) => {
        const files = await this.deps.cadastroRepository.listDocumentFiles(
          document.id
        );
        return {
          documentId: document.id,
          submissionId: submission.id,
          requirementId: document.requirementId,
          title: document.title,
          status: document.status,
          version: submission.version,
          documentVersion: document.version,
          reviewComment: document.reviewComment ?? undefined,
          submittedAt: submission.submittedAt?.toISOString() ?? undefined,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
          fileCount: files.length,
          files: files.map(serializeFile),
        };
      })
    );

    return { items, total: items.length };
  }
}

export class SubmitCadastroRequirementUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    requirementId: string;
    userId: string;
    scope: ScopeContext;
    documentId?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const requirement = (
      await this.deps.conformityRepository.findActiveRequirements({
        taxIdType: resolveFacilityTaxIdType(facility),
      })
    ).find((r) => r.id === input.requirementId);
    if (!requirement) {
      throw new ResourceNotFoundError("ConformityRequirement", input.requirementId);
    }

    let document = input.documentId
      ? await this.deps.cadastroRepository.findDocumentById(input.documentId)
      : null;

    if (!document) {
      const draft = await this.deps.cadastroRepository.findDraftByFacility(
        input.facilityId
      );
      if (!draft) {
        throw new ValidationError([
          {
            field: "requirementId",
            message: "Nenhum rascunho com arquivos para enviar",
          },
        ]);
      }
      document =
        await this.deps.cadastroRepository.findDocumentBySubmissionAndRequirement(
          draft.id,
          input.requirementId
        );
    }

    if (!document || document.requirementId !== input.requirementId) {
      throw new ResourceNotFoundError(
        "SubmissionDocument",
        input.documentId ?? input.requirementId
      );
    }

    const submission = await this.deps.cadastroRepository.findById(
      document.submissionId
    );
    if (!submission || submission.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("CadastroSubmission", document.submissionId);
    }
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ForbiddenError();
    }
    if (
      document.status !== "DRAFT" &&
      document.status !== "READY" &&
      document.status !== "CHANGES_REQUESTED" &&
      document.status !== "PROCESSING"
    ) {
      throw new ValidationError([
        {
          field: "documentId",
          message: "Este documento já foi enviado ou não pode ser reenviado",
        },
      ]);
    }

    await pruneIncompleteDocumentUploads(
      this.deps.cadastroRepository,
      document.id
    );
    const files = await this.deps.cadastroRepository.listDocumentFiles(document.id);
    if (files.length === 0) {
      throw new ValidationError([
        { field: "files", message: "Adicione ao menos um arquivo pronto" },
      ]);
    }
    const notReady = files.filter((f) => f.fileAsset?.status !== "READY");
    if (notReady.length > 0) {
      throw new ValidationError([
        {
          field: "files",
          message: "Aguarde o processamento de todos os arquivos",
        },
      ]);
    }
    if (requirement.requiresFrontAndBack) {
      const roles = new Set(files.map((f) => f.role));
      if (!roles.has("FRONT") || !roles.has("BACK")) {
        // PAGE-only uploads are accepted when front/back roles are not used.
        if (files.length < 2 && !roles.has("PAGE")) {
          throw new ValidationError([
            {
              field: "files",
              message: `${requirement.name} exige frente e verso`,
            },
          ]);
        }
      }
    }

    await this.deps.cadastroRepository.updateDocumentStatus({
      id: document.id,
      status: "UNDER_REVIEW",
    });

    const updated = await this.deps.cadastroRepository.updateSubmissionStatus({
      id: submission.id,
      status: "UNDER_REVIEW",
      submittedAt: new Date(),
      submittedByUserId: input.userId,
    });

    return {
      documentId: document.id,
      submissionId: updated.id,
      status: "UNDER_REVIEW" as const,
      version: updated.version,
      submittedAt: updated.submittedAt?.toISOString(),
    };
  }
}
