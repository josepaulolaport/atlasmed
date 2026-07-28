import { randomUUID } from "node:crypto";
import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { AvatarStoragePort } from "../../../access/application/use-cases/update-avatar.use-case";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { CadastroSubmissionRepository } from "../interfaces/cadastro-submission.repository.interface";
import {
  FacilityCadastroCompletionService,
  isBillingEmailComplete,
} from "../services/facility-cadastro-completion.service";
import { resolveCadastroVerticalId } from "../utils/cadastro-vertical-inference.utils";
import { resolveFacilityTaxIdType } from "../utils/facility-tax-id.utils";
import { storageService } from "../../../../infrastructure/storage/storage.service";

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const documentExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function resolveDocumentExtension(file: File): string | null {
  const type = (file.type || "").toLowerCase().trim();
  if (type && documentExtensions[type]) return documentExtensions[type]!;

  // iOS / pickers sometimes omit Content-Type — fall back to filename.
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
}

function resolveDocumentContentType(file: File, extension: string): string {
  const type = (file.type || "").toLowerCase().trim();
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/png" || type === "image/webp" || type === "application/pdf") {
    return type;
  }
  switch (extension) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return type || "application/octet-stream";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stable checklist order (not alphabetical). */
const REQUIREMENT_SLUG_ORDER = [
  "identidade",
  "crm",
  "comprovante_endereco",
  "carta_cnpj",
  "licenca_sanitaria",
] as const;

interface Dependencies {
  facilityRepository: FacilityRepository;
  conformityRepository: ConformityRepository;
  storage: AvatarStoragePort & { download(key: string): Promise<Uint8Array> };
  completionService: FacilityCadastroCompletionService;
  cadastroRepository?: CadastroSubmissionRepository;
}

function mapSubmissionDocumentUiStatus(
  status: string | undefined
): "missing" | "ready" | "pending" | "approved" | "rejected" {
  switch (status) {
    case "PROCESSING":
    case "DRAFT":
    case "READY":
      // READY = files processed in a draft, not an official "Pronto"/approved doc.
      return "missing";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "pending";
    case "APPROVED":
      return "approved";
    case "REJECTED":
    case "CHANGES_REQUESTED":
      return "rejected";
    default:
      return "missing";
  }
}

function sortRequirementsByCatalogOrder<T extends { slug: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = REQUIREMENT_SLUG_ORDER.indexOf(
      a.slug as (typeof REQUIREMENT_SLUG_ORDER)[number]
    );
    const bi = REQUIREMENT_SLUG_ORDER.indexOf(
      b.slug as (typeof REQUIREMENT_SLUG_ORDER)[number]
    );
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.slug.localeCompare(b.slug);
  });
}

function cadastroFileUrl(key: string): string {
  return `/api/v1/facilities/cadastro/files/${key}`;
}

function mapRecordStatusToUi(
  status: string | undefined
): "missing" | "pending" | "approved" | "rejected" {
  switch (status) {
    case "SUBMITTED":
      return "pending";
    case "VALIDATED":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return "missing";
  }
}

function serializeRecord(record: {
  id: string;
  facilityId: string;
  requirementId: string;
  status: string;
  submittedAt: Date | null;
  validatedAt: Date | null;
  storageKey: string | null;
  url: string | null;
  contentType: string | null;
  fileName: string | null;
  reviewerNote: string | null;
  requirement: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    appliesToTaxIdType: "PF" | "PJ" | null;
  };
  facility?: { id: string; name: string; taxIdType: "PF" | "PJ" | null };
}) {
  return {
    id: record.id,
    facilityId: record.facilityId,
    requirementId: record.requirementId,
    requirement: {
      id: record.requirement.id,
      slug: record.requirement.slug,
      name: record.requirement.name,
      description: record.requirement.description ?? undefined,
      appliesToTaxIdType: record.requirement.appliesToTaxIdType ?? undefined,
    },
    status: record.status,
    uiStatus: mapRecordStatusToUi(record.status),
    submittedAt: record.submittedAt?.toISOString(),
    validatedAt: record.validatedAt?.toISOString(),
    url: record.url ?? undefined,
    contentType: record.contentType ?? undefined,
    fileName: record.fileName ?? undefined,
    reviewerNote: record.reviewerNote ?? undefined,
    facility: record.facility
      ? {
          id: record.facility.id,
          name: record.facility.name,
          taxIdType: record.facility.taxIdType ?? undefined,
        }
      : undefined,
  };
}

export class GetFacilityCadastroChecklistUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const taxIdType = resolveFacilityTaxIdType(facility);

    const requirements = sortRequirementsByCatalogOrder(
      await this.deps.conformityRepository.findActiveRequirements({
        taxIdType,
      })
    );
    const records = await this.deps.conformityRepository.findRecordsByFacility(
      input.facilityId
    );
    const recordByRequirement = new Map(records.map((r) => [r.requirementId, r]));

    const draft =
      (await this.deps.cadastroRepository?.findDraftByFacility(input.facilityId)) ??
      (await this.deps.cadastroRepository?.findLatestByFacility(input.facilityId));
    const submissionDocs = draft
      ? await this.deps.cadastroRepository!.findDocumentsBySubmission(draft.id)
      : [];
    const submissionDocByRequirement = new Map(
      submissionDocs.map((d) => [d.requirementId, d])
    );

    const documents = await Promise.all(
      requirements.map(async (requirement) => {
        const submissionDoc = submissionDocByRequirement.get(requirement.id);
        const record = recordByRequirement.get(requirement.id);

        const history = this.deps.cadastroRepository
          ? await this.deps.cadastroRepository.listDocumentsForFacilityRequirement({
              facilityId: input.facilityId,
              requirementId: requirement.id,
              excludeDraft: true,
            })
          : [];
        const latestSubmitted = history[0] ?? null;
        const approvedEntry =
          history.find((h) => h.document.status === "APPROVED") ?? null;

        // List/detail pill: approved → pending review → rejected. Never "ready"/Pronto.
        const uiStatus = approvedEntry
          ? ("approved" as const)
          : latestSubmitted
            ? mapSubmissionDocumentUiStatus(latestSubmitted.document.status)
            : mapRecordStatusToUi(record?.status);

        // Official current files = approved only. Draft READY files stay off this surface.
        const displayDoc = approvedEntry?.document ?? null;
        const files = displayDoc
          ? await this.deps.cadastroRepository!.listDocumentFiles(displayDoc.id)
          : [];

        return {
          requirementId: requirement.id,
          slug: requirement.slug,
          name: requirement.name,
          description: requirement.description ?? undefined,
          appliesToTaxIdType: requirement.appliesToTaxIdType ?? undefined,
          kind: "file" as const,
          required: true,
          uiStatus,
          documentId:
            displayDoc?.id ??
            latestSubmitted?.document.id ??
            submissionDoc?.id,
          documentStatus:
            displayDoc?.status ??
            latestSubmitted?.document.status ??
            (submissionDoc?.status === "READY" ||
            submissionDoc?.status === "DRAFT" ||
            submissionDoc?.status === "PROCESSING"
              ? undefined
              : submissionDoc?.status),
          latestSubmittedStatus: latestSubmitted?.document.status,
          latestSubmittedAt:
            latestSubmitted?.submission.submittedAt?.toISOString() ?? undefined,
          currentApproved: approvedEntry
            ? {
                documentId: approvedEntry.document.id,
                submissionId: approvedEntry.submission.id,
                version: approvedEntry.submission.version,
                submittedAt:
                  approvedEntry.submission.submittedAt?.toISOString() ??
                  undefined,
                reviewComment: approvedEntry.document.reviewComment ?? undefined,
                fileCount: (
                  await this.deps.cadastroRepository!.listDocumentFiles(
                    approvedEntry.document.id
                  )
                ).length,
              }
            : undefined,
          files: files.map((f) => ({
            fileAssetId: f.fileAssetId,
            position: f.position,
            role: f.role,
            fileName: f.fileAsset?.originalFilename,
            status: f.fileAsset?.status,
            contentType:
              f.fileAsset?.detectedMimeType ?? f.fileAsset?.declaredMimeType,
          })),
          record: record ? serializeRecord(record) : undefined,
        };
      })
    );

    const billingEmail = facility.billingEmail?.trim() || null;
    const billingComplete = isBillingEmailComplete(billingEmail);

    const billingRow = {
      slug: "billing_email",
      name: "Email Administrativo",
      description: "Email administrativo do estabelecimento.",
      kind: "billing_email" as const,
      required: true,
      uiStatus: billingComplete ? ("approved" as const) : ("missing" as const),
      billingEmail,
    };

    const pendingFileCount = documents.filter(
      (d) => d.uiStatus === "missing" || d.uiStatus === "rejected"
    ).length;
    const pendingBillingCount = billingComplete ? 0 : 1;
    const pendingCount = pendingFileCount + pendingBillingCount;
    const validatedFileCount = documents.filter((d) => d.uiStatus === "approved").length;

    return {
      facilityId: facility.id,
      taxIdType,
      billingEmail,
      commercialStatus: facility.commercialStatus ?? undefined,
      conformityStatus: facility.conformityStatus,
      submissionId: draft?.id,
      submissionStatus: draft?.status,
      submissionVersion: draft?.version,
      documents,
      billing: billingRow,
      counts: {
        requiredDocuments: documents.length,
        validatedDocuments: validatedFileCount,
        pendingAction: pendingCount,
        billingComplete,
        complete: pendingCount === 0 && validatedFileCount === documents.length && billingComplete,
      },
    };
  }
}

export class UpdateFacilityBillingEmailUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    email: string;
    verticalId?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new ValidationError([
        { field: "email", message: "Email administrativo inválido" },
      ]);
    }

    await this.deps.facilityRepository.update(input.facilityId, {
      billingEmail: email,
    });

    const resolvedVerticalId = await resolveCadastroVerticalId({
      facilityId: input.facilityId,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      facilityRepository: this.deps.facilityRepository,
      verticalId: input.verticalId,
    });

    const completion = await this.deps.completionService.evaluateAndApply(
      input.facilityId,
      resolvedVerticalId,
    );

    return {
      facilityId: input.facilityId,
      billingEmail: email,
      ...completion,
    };
  }
}

export class SubmitFacilityCadastroDocumentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    requirementId: string;
    scope: ScopeContext;
    file: File;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const requirement = await this.deps.conformityRepository.findRequirementById(
      input.requirementId
    );
    if (!requirement || !requirement.isActive) {
      throw new ResourceNotFoundError("ConformityRequirement", input.requirementId);
    }

    if (
      requirement.appliesToTaxIdType != null &&
      facility.taxIdType != null &&
      requirement.appliesToTaxIdType !== facility.taxIdType
    ) {
      throw new ForbiddenError();
    }

    const extension = resolveDocumentExtension(input.file);
    if (!extension) {
      throw new ValidationError([
        {
          field: "file",
          message: "Documento deve ser JPEG, PNG, WebP ou PDF",
        },
      ]);
    }

    if (input.file.size === 0 || input.file.size > MAX_DOC_BYTES) {
      throw new ValidationError([
        { field: "file", message: "Documento deve ter entre 1 byte e 10 MB" },
      ]);
    }

    const contentType = resolveDocumentContentType(input.file, extension);
    const safeName = (input.file.name || `${requirement.slug}.${extension}`)
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_");

    const existing = await this.deps.conformityRepository.findRecordByFacilityAndRequirement(
      input.facilityId,
      input.requirementId
    );
    if (existing?.storageKey) {
      try {
        await this.deps.storage.delete(existing.storageKey);
      } catch {
        // Best-effort cleanup of prior object.
      }
    }

    const key = `facilities/${input.facilityId}/cadastro/${requirement.slug}/${randomUUID()}.${extension}`;
    await this.deps.storage.upload(
      key,
      new Uint8Array(await input.file.arrayBuffer()),
      contentType
    );

    const record = await this.deps.conformityRepository.upsertSubmittedRecord({
      facilityId: input.facilityId,
      requirementId: input.requirementId,
      storageKey: key,
      url: cadastroFileUrl(key),
      contentType,
      fileName: safeName || `${requirement.slug}.${extension}`,
    });

    const resolvedVerticalId = await resolveCadastroVerticalId({
      facilityId: input.facilityId,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      facilityRepository: this.deps.facilityRepository,
    });

    await this.deps.completionService.evaluateAndApply(
      input.facilityId,
      resolvedVerticalId,
    );

    return serializeRecord(record);
  }
}

export class DownloadFacilityCadastroFileUseCase {
  constructor(
    private readonly deps: Pick<Dependencies, "conformityRepository" | "storage">
  ) {}

  async execute(input: { storageKey: string }) {
    if (
      !/^facilities\/[a-zA-Z0-9_-]+\/cadastro\/[a-z0-9_]+\/[a-z0-9-]+\.(jpg|png|webp|pdf)$/.test(
        input.storageKey
      )
    ) {
      throw new ValidationError([
        { field: "key", message: "Invalid cadastro file key" },
      ]);
    }

    const record = await this.deps.conformityRepository.findRecordByStorageKey(
      input.storageKey
    );
    if (!record || !record.contentType) {
      throw new ResourceNotFoundError("ConformityRecord", input.storageKey);
    }

    const bytes = await this.deps.storage.download(input.storageKey);
    return { bytes, contentType: record.contentType };
  }
}

export class ApproveFacilityCadastroRecordUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    recordId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const record = await this.deps.conformityRepository.findRecordById(input.recordId);
    if (!record || record.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("ConformityRecord", input.recordId);
    }

    if (record.status !== "SUBMITTED") {
      throw new ValidationError([
        {
          field: "recordId",
          message: "Somente documentos enviados podem ser aprovados",
        },
      ]);
    }

    const approved = await this.deps.conformityRepository.approveRecord({
      recordId: input.recordId,
      validatedByUserId: input.userId,
    });

    const resolvedVerticalId = await resolveCadastroVerticalId({
      facilityId: input.facilityId,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      facilityRepository: this.deps.facilityRepository,
    });

    const completion = await this.deps.completionService.evaluateAndApply(
      input.facilityId,
      resolvedVerticalId,
    );

    return { ...serializeRecord(approved), ...completion };
  }
}

export class RejectFacilityCadastroRecordUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    recordId: string;
    userId: string;
    scope: ScopeContext;
    reviewerNote: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const note = input.reviewerNote.trim();
    if (note.length < 1) {
      throw new ValidationError([
        { field: "reviewerNote", message: "Motivo da rejeição é obrigatório" },
      ]);
    }

    const record = await this.deps.conformityRepository.findRecordById(input.recordId);
    if (!record || record.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("ConformityRecord", input.recordId);
    }

    if (record.status !== "SUBMITTED") {
      throw new ValidationError([
        {
          field: "recordId",
          message: "Somente documentos enviados podem ser rejeitados",
        },
      ]);
    }

    const rejected = await this.deps.conformityRepository.rejectRecord({
      recordId: input.recordId,
      validatedByUserId: input.userId,
      reviewerNote: note,
    });

    const resolvedVerticalId = await resolveCadastroVerticalId({
      facilityId: input.facilityId,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      facilityRepository: this.deps.facilityRepository,
    });

    const completion = await this.deps.completionService.evaluateAndApply(
      input.facilityId,
      resolvedVerticalId,
    );

    return { ...serializeRecord(rejected), ...completion };
  }
}

function mapOpsQueueQueryStatus(
  status?: "SUBMITTED" | "VALIDATED" | "REJECTED" | "UNDER_REVIEW" | "APPROVED"
): Array<"UNDER_REVIEW" | "APPROVED" | "REJECTED"> {
  switch (status) {
    case "VALIDATED":
    case "APPROVED":
      return ["APPROVED"];
    case "REJECTED":
      return ["REJECTED"];
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case undefined:
      return ["UNDER_REVIEW"];
    default:
      return ["UNDER_REVIEW"];
  }
}

/** Legacy mobile filter labels still expect SUBMITTED/VALIDATED. */
function mapDocumentStatusForOpsQueue(status: string): string {
  switch (status) {
    case "APPROVED":
      return "VALIDATED";
    case "REJECTED":
      return "REJECTED";
    case "UNDER_REVIEW":
    case "SUBMITTED":
      return "SUBMITTED";
    default:
      return status;
  }
}

export class ListCadastroSubmissionsUseCase {
  constructor(
    private readonly deps: Pick<
      Dependencies,
      "conformityRepository" | "facilityRepository" | "cadastroRepository"
    >
  ) {}

  async execute(input: {
    status?: "SUBMITTED" | "VALIDATED" | "REJECTED" | "UNDER_REVIEW" | "APPROVED";
    page?: number;
    limit?: number;
  }) {
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 100) : 50;

    // Prefer versioned submission documents (per-requirement send flow).
    if (this.deps.cadastroRepository) {
      const documentStatuses = mapOpsQueueQueryStatus(input.status);
      const { items, total } =
        await this.deps.cadastroRepository.listDocumentsForReview({
          status: documentStatuses,
          page,
          limit,
        });

      const data = await Promise.all(
        items.map(async ({ document, submission, submittedByName }) => {
          const facility = await this.deps.facilityRepository.findById(
            submission.facilityId
          );
          const files = await this.deps.cadastroRepository!.listDocumentFiles(
            document.id
          );
          const serializedFiles = await Promise.all(
            files.map(async (f) => {
              const asset = f.fileAsset;
              let url: string | undefined;
              if (asset?.objectKey) {
                try {
                  url = await storageService.signedGetUrl(asset.objectKey, 900);
                } catch {
                  url = undefined;
                }
              }
              return {
                fileAssetId: f.fileAssetId,
                position: f.position,
                role: f.role,
                fileName: asset?.originalFilename,
                status: asset?.status,
                contentType:
                  asset?.detectedMimeType ?? asset?.declaredMimeType,
                url,
              };
            })
          );
          const first = serializedFiles[0];
          return {
            id: document.id,
            facilityId: submission.facilityId,
            requirementId: document.requirementId,
            requirement: document.requirement
              ? {
                  id: document.requirement.id,
                  slug: document.requirement.slug,
                  name: document.requirement.name,
                  description: document.requirement.description ?? undefined,
                  appliesToTaxIdType:
                    document.requirement.appliesToTaxIdType ?? undefined,
                }
              : {
                  id: document.requirementId,
                  slug: document.requirementId,
                  name: document.title,
                },
            status: mapDocumentStatusForOpsQueue(document.status),
            documentStatus: document.status,
            submissionId: submission.id,
            submissionStatus: submission.status,
            uiStatus: mapSubmissionDocumentUiStatus(document.status),
            submittedAt: submission.submittedAt?.toISOString(),
            submittedByUserId: submission.submittedByUserId ?? undefined,
            submittedByName: submittedByName ?? undefined,
            validatedAt:
              document.status === "APPROVED"
                ? document.updatedAt.toISOString()
                : undefined,
            url: first?.url,
            contentType: first?.contentType ?? undefined,
            fileName: first?.fileName ?? undefined,
            fileAssetId: first?.fileAssetId,
            files: serializedFiles,
            reviewerNote: document.reviewComment ?? undefined,
            facility: facility
              ? (() => {
                  const taxIdType = resolveFacilityTaxIdType(facility);
                  const address = [
                    facility.streetAddress,
                    facility.streetNumber,
                    facility.addressComplement,
                    facility.neighborhood,
                  ]
                    .filter((p): p is string => !!p && p.trim().length > 0)
                    .join(", ");
                  const city = [facility.city, facility.state]
                    .filter((p): p is string => !!p && p.trim().length > 0)
                    .join(", ");
                  return {
                    id: facility.id,
                    name: facility.name,
                    taxIdType,
                    taxId: taxIdType === "PF" ? facility.cpf : facility.cnpj,
                    phone: facility.phone ?? undefined,
                    email:
                      facility.email ?? facility.billingEmail ?? undefined,
                    address: address.length > 0 ? address : undefined,
                    city: city.length > 0 ? city : undefined,
                    consultantName: facility.consultantName ?? undefined,
                  };
                })()
              : undefined,
          };
        })
      );

      return { data, page, limit, total };
    }

    const legacyStatus =
      input.status === "APPROVED"
        ? "VALIDATED"
        : input.status === "UNDER_REVIEW"
          ? "SUBMITTED"
          : (input.status ?? "SUBMITTED");
    const { records, total } =
      await this.deps.conformityRepository.findSubmittedRecords({
        status: legacyStatus as "SUBMITTED" | "VALIDATED" | "REJECTED",
        page,
        limit,
      });

    return {
      data: records.map(serializeRecord),
      page,
      limit,
      total,
    };
  }
}
