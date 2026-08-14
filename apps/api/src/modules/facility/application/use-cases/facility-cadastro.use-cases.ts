import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import {
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type {
  FacilityRepository,
  FacilityVerticalProfileRecord,
} from "../interfaces/facility.repository.interface";
import type {
  CadastroSubmissionRepository,
  DocumentFileRecord,
  SubmissionDocumentRecord,
} from "../interfaces/cadastro-submission.repository.interface";
import {
  FacilityCadastroCompletionService,
  isBillingEmailComplete,
} from "../services/facility-cadastro-completion.service";
import { resolveCadastroVerticalId } from "../utils/cadastro-vertical-inference.utils";
import { resolveFacilityLegalDocumentType } from "../utils/facility-tax-id.utils";
import { storageService } from "../../../../infrastructure/storage/storage.service";
import { deriveExpiry } from "../utils/cadastro-validity.utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stable checklist order (not alphabetical). */
const REQUIREMENT_SLUG_ORDER = [
  "identidade",
  "crm",
  "comprovante_endereco",
  "carta_cnpj",
  "licenca_sanitaria",
] as const;

/**
 * A document still open for work: the checklist's "working document".
 *
 * Must stay identical to the status list in
 * `CadastroSubmissionRepository.findWorkingDocument`. The checklist now decides
 * this in memory over one facility-wide query rather than asking per
 * requirement, so a status added there and not here would quietly stop being
 * treated as open on this page while every other caller kept seeing it.
 */
const OPEN_DOCUMENT_STATUSES = new Set([
  "DRAFT",
  "PROCESSING",
  "READY",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
]);

/**
 * Actually sent for review — the history the page shows. Mirrors the
 * `excludeDraft: true` branch of `listDocumentsForFacilityRequirement`, which
 * is why DRAFT/PROCESSING/READY are absent and SUPERSEDED is present.
 */
const SUBMITTED_DOCUMENT_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "SUPERSEDED",
]);

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  conformityRepository: ConformityRepository;
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
  id: number;
  facilityId: number;
  requirementId: number;
  status: string;
  submittedAt: Date | null;
  validatedAt: Date | null;
  storageKey: string | null;
  url: string | null;
  contentType: string | null;
  fileName: string | null;
  reviewerNote: string | null;
  requirement: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    appliesToLegalDocumentType: "CNPJ" | "CPF" | null;
  };
  facility?: { id: number; name: string; legalDocumentType: "CNPJ" | "CPF" | null };
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
      appliesToLegalDocumentType: record.requirement.appliesToLegalDocumentType ?? undefined,
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
          legalDocumentType: record.facility.legalDocumentType ?? undefined,
        }
      : undefined,
  };
}

/** One physical file of a logical cadastro document, as the checklist serializes it. */
function serializeDocumentFile(file: DocumentFileRecord) {
  return {
    fileAssetId: file.fileAssetId,
    position: file.position,
    role: file.role,
    fileName: file.fileAsset?.originalFilename,
    status: file.fileAsset?.status,
    contentType: file.fileAsset?.detectedMimeType ?? file.fileAsset?.declaredMimeType,
  };
}

export class GetFacilityCadastroChecklistUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: number; scope: ScopeContext; now?: Date }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const legalDocumentType = resolveFacilityLegalDocumentType(facility);

    // One cadastro page per clinic (ADR 0007). The rep sees the requirements of
    // the linhas they and the clinic have in common, plus the facility-scoped
    // ones — not a per-linha switcher, and never another linha's documents.
    const requirements = sortRequirementsByCatalogOrder(
      await this.loadRequirementsForCaller({
        facilityId: input.facilityId,
        legalDocumentType,
        scope: input.scope,
        // `findById` above already loaded this clinic's vertical profiles to
        // build its record, through the same helper this used to call again a
        // few lines later — the identical query, twice per request. Both are
        // locally reasonable (the repository owes a complete DTO; a use case
        // cannot know what the repository already fetched), which is why it
        // survived: the response is byte-identical either way and no test
        // could see it.
        verticalProfiles: facility.verticalProfiles,
      })
    );
    const records = await this.deps.conformityRepository.findRecordsByFacility(
      input.facilityId
    );
    const recordByRequirement = new Map(records.map((r) => [r.requirementId, r]));

    // The whole checklist's documents in one query, then grouped in memory.
    //
    // This used to ask per requirement: the working document, the history, and
    // then the files of each — up to four round trips per row, which made
    // /cadastro the slowest endpoint on the clinic screen at ~1.7s. The
    // per-requirement helpers still exist and are still used elsewhere; the
    // checklist just stopped calling them once per row.
    const allDocuments = this.deps.cadastroRepository
      ? await this.deps.cadastroRepository.listDocumentsByFacility(input.facilityId)
      : [];
    const documentsByRequirement = groupBy(allDocuments, (d) => d.requirementId);

    // Both passes below read from the same already-sorted list, so the ordering
    // the repository guarantees (version DESC, updatedAt DESC) is what decides
    // "working" and "latest" — exactly as when Postgres decided it per query.
    const workingByRequirement = new Map<number, SubmissionDocumentRecord>();
    const historyByRequirement = new Map<number, SubmissionDocumentRecord[]>();
    for (const [requirementId, docs] of documentsByRequirement) {
      const working = docs.find((d) => OPEN_DOCUMENT_STATUSES.has(d.status));
      if (working) workingByRequirement.set(requirementId, working);
      historyByRequirement.set(
        requirementId,
        docs.filter((d) => SUBMITTED_DOCUMENT_STATUSES.has(d.status))
      );
    }

    // One files query for every document the page will render — the working
    // document and the approved one for each requirement.
    const fileDocumentIds = new Set<number>();
    for (const requirement of requirements) {
      const history = historyByRequirement.get(requirement.id) ?? [];
      const approved = history.find((d) => d.status === "APPROVED");
      const working =
        workingByRequirement.get(requirement.id) ?? approved ?? history[0];
      if (working) fileDocumentIds.add(working.id);
      if (approved) fileDocumentIds.add(approved.id);
    }
    const allFiles = this.deps.cadastroRepository
      ? await this.deps.cadastroRepository.listDocumentFilesForDocuments([
          ...fileDocumentIds,
        ])
      : [];
    const filesByDocument = groupBy(allFiles, (f) => f.submissionDocumentId);

    const documents = await Promise.all(
      requirements.map(async (requirement) => {
        const record = recordByRequirement.get(requirement.id);

        const workingDocument = workingByRequirement.get(requirement.id) ?? null;

        const history = historyByRequirement.get(requirement.id) ?? [];
        const latestSubmitted = history[0] ?? null;
        const approvedEntry =
          history.find((document) => document.status === "APPROVED") ?? null;

        // List/detail pill: approved → pending review → rejected. Never "ready"/Pronto.
        const uiStatus = approvedEntry
          ? ("approved" as const)
          : latestSubmitted
            ? mapSubmissionDocumentUiStatus(latestSubmitted.status)
            : mapRecordStatusToUi(record?.status);

        // Two screens want two different documents, so they get two fields.
        //
        // Top level (documentId / documentStatus / files) = the WORKING
        // document — what the rep is editing right now, in precedence order:
        //   1. the open attempt at this requirement: the row the compose screen
        //      uploads into, so its files must be visible while it is still a
        //      DRAFT (spec 0011 §8.1 / D-08 — returning the approved document's
        //      files here left the client poll loop with nothing to match and
        //      "Enviar" disabled on every re-upload over an already-approved
        //      requirement);
        //   2. the approved document, when there is no open attempt;
        //   3. the last document actually sent for review.
        //
        // `currentApproved` (below) carries the APPROVED document and its own
        // files — that is what the "DOCUMENTO ATUAL" card renders under its
        // "Versão aprovada vN" label.
        const workingDoc =
          workingDocument ?? approvedEntry ?? latestSubmitted ?? null;
        const files = workingDoc ? (filesByDocument.get(workingDoc.id) ?? []) : [];
        const approvedFiles = approvedEntry
          ? (filesByDocument.get(approvedEntry.id) ?? [])
          : [];

        return {
          requirementId: requirement.id,
          slug: requirement.slug,
          name: requirement.name,
          description: requirement.description ?? undefined,
          appliesToLegalDocumentType: requirement.appliesToLegalDocumentType ?? undefined,
          kind: "file" as const,
          required: true,
          uiStatus,
          documentId: workingDoc?.id,
          documentStatus: workingDoc?.status,
          latestSubmittedStatus: latestSubmitted?.status,
          latestSubmittedAt: latestSubmitted?.submittedAt?.toISOString() ?? undefined,
          currentApproved: approvedEntry
            ? {
                documentId: approvedEntry.id,
                version: approvedEntry.version,
                submittedAt: approvedEntry.submittedAt?.toISOString() ?? undefined,
                reviewComment: approvedEntry.reviewComment ?? undefined,
                fileCount: approvedFiles.length,
                files: approvedFiles.map(serializeDocumentFile),
              }
            : undefined,
          files: files.map(serializeDocumentFile),
          // Derived here, never stored (ADR 0008 §4). The date on the document
          // is the truth; this is a function of it and today, so it cannot go
          // stale and no nightly job can stop writing it.
          // The upload limits travel with the checklist so the client can refuse
          // an oversized file before any request (spec 0011 §7). They were only
          // on the POST /documents response, which meant the client had to
          // create a document just to learn them — a read with a side effect,
          // leaving an empty DRAFT behind whenever the file was then rejected.
          allowedMimeTypes: requirement.allowedMimeTypes,
          maxFiles: requirement.maxFiles,
          maxFileSizeBytes: requirement.maxFileSizeBytes,
          maxCombinedSizeBytes: requirement.maxCombinedSizeBytes,
          requiresFrontAndBack: requirement.requiresFrontAndBack,
          requiresValidityDate: requirement.requiresValidityDate,
          validUntil: workingDoc?.validUntil ?? undefined,
          expiry: deriveExpiry(
            (approvedEntry ?? workingDoc)?.validUntil,
            input.now ?? new Date()
          ) ?? undefined,
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
      legalDocumentType,
      billingEmail,
      commercialStatus: facility.commercialStatus ?? undefined,
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

  /**
   * The requirements this caller should see for this clinic: the linhas they
   * have in common, plus every facility-scoped requirement.
   *
   * A rep working Ortopedia at a clinic that runs Ortopedia and Dermatologia
   * sees Ortopedia's documents and the shared ones — never Dermatologia's. A
   * global user sees every linha the clinic actually runs. When there is no
   * overlap at all, only the facility-scoped documents remain, which is the
   * honest answer: nothing linha-specific applies.
   */
  private async loadRequirementsForCaller(input: {
    facilityId: number;
    legalDocumentType: ReturnType<typeof resolveFacilityLegalDocumentType>;
    scope: ScopeContext;
    /**
     * The caller's already-loaded profiles, when it has them.
     *
     * Unfiltered, exactly as the repository returns them — `loadVerticalProfiles`
     * selects `is_active` rather than filtering on it, so the `isActive` test
     * below still decides which linhas count. Falls back to a query when a
     * caller has none, so a repository that does not populate the field behaves
     * as it always did.
     */
    verticalProfiles?: FacilityVerticalProfileRecord[];
  }) {
    const profiles =
      input.verticalProfiles ??
      (
        await this.deps.facilityRepository.findVerticalProfilesByFacilityIds([
          input.facilityId,
        ])
      ).get(input.facilityId) ??
      [];
    const clinicVerticalIds = profiles
      .filter((profile) => profile.isActive)
      .map((profile) => profile.verticalId);

    const assigned = input.scope.assignedVerticalIds ?? [];
    const verticalIds = input.scope.isGlobal
      ? clinicVerticalIds
      : clinicVerticalIds.filter((id) => assigned.includes(id));

    if (verticalIds.length === 0) {
      // No shared linha: only requirements that apply to everyone. Asking
      // without a verticalId would return every linha's documents, which is
      // exactly the leak D-49 fixed elsewhere.
      const all = await this.deps.conformityRepository.findActiveRequirements({
        legalDocumentType: input.legalDocumentType,
      });
      return all.filter((requirement) => requirement.verticalId == null);
    }

    // Each call already includes the unscoped requirements (null vertical means
    // applies-to-all, ADR 0007), so dedupe by id after the union.
    const perVertical = await Promise.all(
      verticalIds.map((verticalId) =>
        this.deps.conformityRepository.findActiveRequirements({
          legalDocumentType: input.legalDocumentType,
          verticalId,
        })
      )
    );

    const byId = new Map<number, (typeof perVertical)[number][number]>();
    for (const requirement of perVertical.flat()) {
      byId.set(requirement.id, requirement);
    }
    return [...byId.values()];
  }
}

export class UpdateFacilityBillingEmailUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    scope: ScopeContext;
    email: string;
    verticalId?: number;
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
      isGlobal: input.scope.isGlobal,
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

export class ApproveFacilityCadastroRecordUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    recordId: number;
    userId: number;
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
      isGlobal: input.scope.isGlobal,
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
    facilityId: number;
    recordId: number;
    userId: number;
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
      isGlobal: input.scope.isGlobal,
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
    scope: ScopeContext;
    page?: number;
    limit?: number;
  }) {
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 100) : 50;

    // D-07: this queue never filtered by scope, so every reviewer saw every
    // territory. It cannot use `assertResourceInScope` — there is no single
    // resource to check — so the restriction is pushed into the query.
    //
    // ADMIN is global and keeps the whole queue. OPS is not global: its
    // `facilityIds` is every facility profiled in the linhas it is assigned
    // (scope-resolver.service.ts), so this scopes by linha rather than by
    // territory, which is what makes a facility no reviewer can see impossible.
    const facilityIds = input.scope.isGlobal ? undefined : input.scope.facilityIds;

    // An empty scope means "nothing", not "everything". Returning early keeps
    // that explicit rather than trusting an empty IN () to behave.
    if (facilityIds !== undefined && facilityIds.length === 0) {
      return { data: [], page, limit, total: 0 };
    }

    // Prefer versioned submission documents (per-requirement send flow).
    if (this.deps.cadastroRepository) {
      const documentStatuses = mapOpsQueueQueryStatus(input.status);
      const { items, total } =
        await this.deps.cadastroRepository.listDocumentsForReview({
          status: documentStatuses,
          facilityIds,
          page,
          limit,
        });

      const data = await Promise.all(
        items.map(async ({ document, facilityId, submittedByName }) => {
          const facility = await this.deps.facilityRepository.findById(facilityId);
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
            facilityId,
            requirementId: document.requirementId,
            requirement: document.requirement
              ? {
                  id: document.requirement.id,
                  slug: document.requirement.slug,
                  name: document.requirement.name,
                  description: document.requirement.description ?? undefined,
                  appliesToLegalDocumentType:
                    document.requirement.appliesToLegalDocumentType ?? undefined,
                }
              : {
                  id: document.requirementId,
                  slug: document.requirementId,
                  name: document.title,
                },
            status: mapDocumentStatusForOpsQueue(document.status),
            documentStatus: document.status,
            uiStatus: mapSubmissionDocumentUiStatus(document.status),
            submittedAt: document.submittedAt?.toISOString(),
            submittedByUserId: document.submittedByUserId ?? undefined,
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
                  const legalDocumentType = resolveFacilityLegalDocumentType(facility);
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
                    legalDocumentType,
                    taxId: facility.legalDocument,
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
