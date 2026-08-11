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
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type {
  CadastroSubmissionRepository,
  FileAssetRecord,
} from "../interfaces/cadastro-submission.repository.interface";
import { FacilityCadastroCompletionService } from "../services/facility-cadastro-completion.service";
import { resolveCadastroVerticalId } from "../utils/cadastro-vertical-inference.utils";
import { resolveFacilityLegalDocumentType } from "../utils/facility-tax-id.utils";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
const UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

async function markDocumentReadyIfAllFilesReady(
  repo: CadastroSubmissionRepository,
  fileAssetId: number
) {
  const link = await repo.findDocumentFileByFileAssetId(fileAssetId);
  if (!link) return;
  const files = await repo.listDocumentFiles(link.submissionDocumentId);
  if (files.length === 0 || !files.every((f) => f.fileAsset?.status === "READY")) {
    return;
  }
  const doc = await repo.findDocumentById(link.submissionDocumentId);
  if (!doc) return;
  if (
    doc.status === "DRAFT" ||
    doc.status === "PROCESSING" ||
    doc.status === "CHANGES_REQUESTED"
  ) {
    await repo.updateDocumentStatus({ id: doc.id, status: "READY" });
  }
}

/**
 * Every non-terminal file-asset status (D-14).
 *
 * READY and FAILED are the terminal pair; everything else means an attempt that
 * stopped somewhere in the middle. This set used to be PENDING_UPLOAD and
 * UPLOADING only, so a process that died between the UPLOADED write and the
 * verification that follows it stranded the file in a state no sweep and no UI
 * could clear. The comment this replaces recorded that the same class of bug had
 * already reached production once and that the fix stopped one status short —
 * enumerate the terminal states instead, so a new status is swept by default
 * rather than forgotten by default.
 */
const TERMINAL_UPLOAD_STATUSES = new Set(["READY", "FAILED"]);

/**
 * Drop abandoned upload attempts that never reached a terminal state.
 * Those ghosts block submit ("Aguarde o processamento…") even when later
 * uploads succeeded (e.g. after a storage outage).
 *
 * Verification is synchronous now (ADR 0008), so UPLOADED is transient inside a
 * single `/uploads/complete` request: a file still sitting in it by submit time
 * is one whose request died between the two writes, which is the same kind of
 * ghost as a PUT that never happened.
 */
async function pruneIncompleteDocumentUploads(
  repo: CadastroSubmissionRepository,
  documentId: number
) {
  const files = await repo.listDocumentFiles(documentId);
  for (const file of files) {
    const status = file.fileAsset?.status;
    if (status && TERMINAL_UPLOAD_STATUSES.has(status)) continue;
    await repo.deleteDocumentFileByFileAssetId(file.fileAssetId);
  }
}

/**
 * Ask the store whether the upload landed, and mark the file READY or FAILED
 * from its answer. The store is the authority; the client only triggers the
 * question (ADR 0008).
 *
 * What this replaces: a full byte download to hash, sniff and then re-upload
 * two byte-identical copies under `/thumb` and `/preview` keys — all on the
 * request thread. No client ever asked for those variants, so it cost three
 * times the storage and the rep's latency for nothing.
 *
 * What is deliberately *not* checked any more:
 *
 * - **The checksum.** It was compared against `input.checksum ?? asset.sha256`,
 *   both of which the client supplied. Hashing bytes to confirm they match the
 *   hash the same client sent proves the transfer was faithful, not that the
 *   file is what it claims.
 * - **The magic number.** The presigned PUT pins Content-Type, so a file whose
 *   bytes disagree with its declared type is still served as the declared type,
 *   which `allowedMimeTypes` already restricted to images and PDFs at initiate.
 *   The cost of dropping the sniff is that a corrupt file is caught by the
 *   reviewer instead of at upload; the benefit is that no byte crosses the API.
 *
 * The byte count is kept, and is the one claim here the store can actually
 * contradict: it is measured server-side and catches a truncated or swapped
 * object, including one that would breach the size limit checked at initiate.
 */
async function verifyUploadedCadastroFile(input: {
  repo: CadastroSubmissionRepository;
  asset: FileAssetRecord;
}): Promise<{ status: "READY" | "FAILED"; errorMessage?: string }> {
  const { repo, asset } = input;
  try {
    const head = await storageService.headObject(asset.objectKey);
    if (!head.exists) {
      throw new Error("Objeto não encontrado no storage");
    }
    if (
      typeof head.contentLength === "number" &&
      head.contentLength !== asset.sizeBytes
    ) {
      throw new Error(
        `Tamanho divergente: ${asset.sizeBytes} bytes declarados, ${head.contentLength} armazenados`
      );
    }

    await repo.updateFileAsset({
      id: asset.id,
      status: "READY",
      processedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });
    await markDocumentReadyIfAllFilesReady(repo, asset.id);
    return { status: "READY" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repo.updateFileAsset({
      id: asset.id,
      status: "FAILED",
      errorCode: "VERIFICATION_FAILED",
      errorMessage: message,
      processedAt: new Date(),
    });
    return { status: "FAILED", errorMessage: message };
  }
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  conformityRepository: ConformityRepository;
  cadastroRepository: CadastroSubmissionRepository;
  completionService: FacilityCadastroCompletionService;
}

function serializeFile(file: {
  id: number;
  position: number;
  role: string;
  fileAsset?: {
    id: number;
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

/**
 * Statuses in which a document still accepts uploads and edits.
 *
 * This gate used to live on the package, which is what wedged clinics: a rep
 * who submitted one requirement flipped the package to UNDER_REVIEW and could
 * no longer upload into any *other* requirement. Per-document, that cannot
 * happen — the linha's other documents are untouched.
 */
const EDITABLE_DOCUMENT_STATUSES = new Set([
  "DRAFT",
  "PROCESSING",
  "READY",
  "CHANGES_REQUESTED",
]);

function assertDocumentEditable(status: string) {
  if (!EDITABLE_DOCUMENT_STATUSES.has(status)) throw new ForbiddenError();
}

async function serializeDocument(
  repo: CadastroSubmissionRepository,
  documentId: number
) {
  const document = await repo.findDocumentById(documentId);
  if (!document) return null;
  const files = await repo.listDocumentFiles(documentId);
  return {
    id: document.id,
    facilityId: document.facilityId,
    facilityVerticalProfileId: document.facilityVerticalProfileId,
    requirementId: document.requirementId,
    title: document.title,
    status: document.status,
    version: document.version,
    reviewComment: document.reviewComment ?? undefined,
    submittedAt: document.submittedAt?.toISOString(),
    requirement: document.requirement
      ? {
          id: document.requirement.id,
          slug: document.requirement.slug,
          name: document.requirement.name,
          description: document.requirement.description ?? undefined,
          appliesToLegalDocumentType: document.requirement.appliesToLegalDocumentType ?? undefined,
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

/**
 * Opens (or returns) the document a rep is working on for one requirement.
 *
 * This replaces the old two-step "ensure a draft package, then create a
 * document inside it". There is no package: the client names a requirement and
 * gets back the row it uploads into.
 *
 * Re-uploading over a finished attempt (APPROVED / REJECTED / SUPERSEDED) opens
 * the next version rather than mutating a reviewed row.
 */
export class CreateCadastroDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    requirementId: number;
    scope: ScopeContext;
    verticalId?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const requirement = await this.deps.conformityRepository.findRequirementById(
      input.requirementId
    );
    if (!requirement || !requirement.isActive) {
      throw new ResourceNotFoundError("ConformityRequirement", input.requirementId);
    }

    const existing = await this.deps.cadastroRepository.findWorkingDocument({
      facilityId: input.facilityId,
      requirementId: input.requirementId,
    });
    if (existing) {
      // An attempt already under review is not an editing surface.
      assertDocumentEditable(existing.status);
      return serializeDocument(this.deps.cadastroRepository, existing.id);
    }

    // A requirement with no vertical applies to every linha, so the document it
    // produces is facility-scoped: uploaded once, counted everywhere (ADR 0007).
    let facilityVerticalProfileId: number | null = null;
    if (requirement.verticalId != null) {
      const profile = await this.deps.facilityRepository.ensureVerticalProfile({
        facilityId: input.facilityId,
        verticalId: requirement.verticalId,
      });
      facilityVerticalProfileId = profile.id;
    }

    const history =
      await this.deps.cadastroRepository.listDocumentsForFacilityRequirement({
        facilityId: input.facilityId,
        requirementId: input.requirementId,
      });
    const nextVersion = (history[0]?.version ?? 0) + 1;

    const document = await this.deps.cadastroRepository.createDocument({
      facilityId: input.facilityId,
      facilityVerticalProfileId,
      requirementId: input.requirementId,
      title: requirement.name,
      version: nextVersion,
    });
    return serializeDocument(this.deps.cadastroRepository, document.id);
  }
}

export class InitiateCadastroFileUploadUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    documentId: number;
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
    if (!document || document.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    assertDocumentEditable(document.status);

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
    const objectKey = `facilities/${input.facilityId}/documents/${document.id}/v${document.version}/files/${fileId}/original`;

    const asset = await this.deps.cadastroRepository.createFileAsset({
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
    facilityId: number;
    uploadSessionId: number;
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

    // Part URLs must live as long as the session they belong to. Signed with
    // the default TTL they expired after 1 hour against a 6-hour session, so a
    // slow or resumed upload got `403 SignatureDoesNotMatch` *after* the bytes
    // were already moving — the failure looked like a storage fault, not an
    // expiry (spec 0011 §2.1).
    const remainingSessionSeconds = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000
    );
    if (remainingSessionSeconds <= 0) {
      throw new ValidationError([
        {
          field: "uploadSessionId",
          message: "Sessão de upload expirada. Inicie o envio novamente.",
        },
      ]);
    }

    const parts = await Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        uploadUrl: await storageService.signedUploadPartUrl(
          asset.objectKey,
          session.storageUploadId,
          partNumber,
          remainingSessionSeconds
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
    facilityId: number;
    uploadSessionId?: number | null;
    fileId: number;
    scope: ScopeContext;
    parts?: Array<{ partNumber: number; etag: string; sizeBytes?: number }>;
    checksum?: string;
  }) {
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
      await storageService.completeMultipartUpload(
        asset.objectKey,
        session.storageUploadId,
        input.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
      );
      await this.deps.cadastroRepository.updateUploadSession({
        id: session.id,
        status: "COMPLETED",
        completedAt: new Date(),
      });
    }

    const uploaded = await this.deps.cadastroRepository.updateFileAsset({
      id: asset.id,
      status: "UPLOADED",
      sha256: input.checksum ?? asset.sha256,
      uploadedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });

    // Both branches verify against the store. The multipart branch used to skip
    // the check entirely: a successful CompleteMultipartUpload says the parts
    // were assembled, not that the result is the object the client promised, so
    // it is exactly the branch where an assembled-but-wrong size can appear.
    const verified = await verifyUploadedCadastroFile({
      repo: this.deps.cadastroRepository,
      asset: uploaded,
    });

    return {
      fileId: asset.id,
      status: verified.status,
      errorMessage: verified.errorMessage,
    };
  }
}

export class ReorderCadastroDocumentFilesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    documentId: number;
    scope: ScopeContext;
    ordered: Array<{
      fileAssetId: number;
      position: number;
      role: CadastroDocumentFileRole;
    }>;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document || document.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    assertDocumentEditable(document.status);

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
    facilityId: number;
    fileAssetId: number;
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

/**
 * Discards one unsent document and the files behind it.
 *
 * The package version of this deleted an entire clinic's cadastro in one call.
 * A document is the unit, so this is the unit of discard too.
 */
export class DeleteCadastroDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    documentId: number;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document || document.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    if (!EDITABLE_DOCUMENT_STATUSES.has(document.status)) {
      throw new ValidationError([
        {
          field: "documentId",
          message: "Documentos já enviados para revisão não podem ser excluídos",
        },
      ]);
    }

    // Read the assets before the cascade removes the document_files links.
    const files = await this.deps.cadastroRepository.listDocumentFiles(document.id);
    const assets = await Promise.all(
      files.map((f) => this.deps.cadastroRepository.findFileAssetById(f.fileAssetId))
    );

    await this.deps.cadastroRepository.deleteDocument(document.id);

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

    return { deleted: true, documentId: document.id };
  }
}

export class ReviewCadastroDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    documentId: number;
    userId: number;
    scope: ScopeContext;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    comment?: string;
    reasonCode?: string;
    flaggedFileAssetIds?: number[];
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const document = await this.deps.cadastroRepository.findDocumentById(
      input.documentId
    );
    if (!document || document.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("SubmissionDocument", input.documentId);
    }
    // Only the document actually awaiting a verdict can receive one.
    if (document.status !== "UNDER_REVIEW" && document.status !== "SUBMITTED") {
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

    // CHANGES_REQUESTED is now exactly this: one status write on one document.
    //
    // It used to supersede the package, open a new version, and clone every
    // document and file row into it. A crash mid-loop left a superseded package
    // beside a half-built draft, and the partial-unique DRAFT index then
    // rejected every retry — the clinic's cadastro wedged permanently (D-16).
    // The safest version of that clone is the one that does not exist.
    await this.deps.cadastroRepository.updateDocumentStatus({
      id: document.id,
      status: input.decision,
      reviewComment: input.comment ?? null,
    });

    // Approving one document can complete a linha. Completion is evaluated for
    // the linha this document belongs to; a facility-scoped document (no
    // profile) can complete any of them, so every linha is re-evaluated.
    if (input.decision === "APPROVED") {
      const verticalIds = await this.resolveVerticalIdsToEvaluate(
        input.facilityId,
        document.facilityVerticalProfileId,
        input.scope
      );
      for (const verticalId of verticalIds) {
        await this.deps.completionService.evaluateAndApply(
          input.facilityId,
          verticalId
        );
      }
    }

    return {
      documentId: document.id,
      decision: input.decision,
    };
  }

  private async resolveVerticalIdsToEvaluate(
    facilityId: number,
    facilityVerticalProfileId: number | null,
    scope: ScopeContext
  ): Promise<number[]> {
    const profiles =
      await this.deps.facilityRepository.findVerticalProfilesByFacilityIds([
        facilityId,
      ]);
    const facilityProfiles = profiles.get(facilityId) ?? [];

    if (facilityVerticalProfileId != null) {
      const owning = facilityProfiles.find(
        (p) => p.id === facilityVerticalProfileId
      );
      if (owning) return [owning.verticalId];
    }

    if (facilityProfiles.length > 0) {
      return facilityProfiles.map((p) => p.verticalId);
    }

    // No profiles at all: fall back to the caller's linha so a facility-scoped
    // approval still records completion somewhere.
    return [
      await resolveCadastroVerticalId({
        facilityId,
        assignedVerticalIds: scope.assignedVerticalIds ?? [],
        isGlobal: scope.isGlobal,
        facilityRepository: this.deps.facilityRepository,
      }),
    ];
  }
}

export class ListCadastroRequirementSubmissionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    requirementId: number;
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
      rows.map(async (document) => {
        const files = await this.deps.cadastroRepository.listDocumentFiles(
          document.id
        );
        return {
          documentId: document.id,
          requirementId: document.requirementId,
          title: document.title,
          status: document.status,
          version: document.version,
          documentVersion: document.version,
          reviewComment: document.reviewComment ?? undefined,
          submittedAt: document.submittedAt?.toISOString() ?? undefined,
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
    facilityId: number;
    requirementId: number;
    userId: number;
    scope: ScopeContext;
    documentId?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) throw new ResourceNotFoundError("Facility", input.facilityId);

    const requirement = (
      await this.deps.conformityRepository.findActiveRequirements({
        legalDocumentType: resolveFacilityLegalDocumentType(facility),
      })
    ).find((r) => r.id === input.requirementId);
    if (!requirement) {
      throw new ResourceNotFoundError("ConformityRequirement", input.requirementId);
    }

    const document = input.documentId
      ? await this.deps.cadastroRepository.findDocumentById(input.documentId)
      : await this.deps.cadastroRepository.findWorkingDocument({
          facilityId: input.facilityId,
          requirementId: input.requirementId,
        });

    if (
      !document ||
      document.requirementId !== input.requirementId ||
      document.facilityId !== input.facilityId
    ) {
      throw new ResourceNotFoundError(
        "SubmissionDocument",
        input.documentId ?? input.requirementId
      );
    }
    if (!EDITABLE_DOCUMENT_STATUSES.has(document.status)) {
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

    // One write. Submitting this document leaves every other requirement for
    // this clinic still editable — under the package, this call froze them all.
    const updated = await this.deps.cadastroRepository.updateDocumentStatus({
      id: document.id,
      status: "UNDER_REVIEW",
      submittedAt: new Date(),
      submittedByUserId: input.userId,
    });

    return {
      documentId: updated.id,
      status: "UNDER_REVIEW" as const,
      version: updated.version,
      submittedAt: updated.submittedAt?.toISOString(),
    };
  }
}
