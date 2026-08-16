import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type {
  ConformityRepository,
  ConformityRequirementRecord,
  ConformityRequirementWritableFields,
  FacilityLegalDocumentType,
} from "../interfaces/conformity.repository.interface";
import {
  ResourceInUseError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

/**
 * The full admin shape of a requirement (spec 0016 §4.7).
 *
 * The picker DTO below omits the upload limits and the two behavioural flags,
 * which is right for a checklist and useless for the screen that sets them.
 */
function serializeRequirementForAdmin(requirement: ConformityRequirementRecord) {
  return {
    id: requirement.id,
    slug: requirement.slug,
    name: requirement.name,
    description: requirement.description,
    verticalId: requirement.verticalId,
    appliesToLegalDocumentType: requirement.appliesToLegalDocumentType,
    isActive: requirement.isActive,
    allowedMimeTypes: requirement.allowedMimeTypes,
    maxFiles: requirement.maxFiles,
    maxFileSizeBytes: requirement.maxFileSizeBytes,
    maxCombinedSizeBytes: requirement.maxCombinedSizeBytes,
    requiresFrontAndBack: requirement.requiresFrontAndBack,
    requiresValidityDate: requirement.requiresValidityDate,
    // Whether delete is available, and what blocks it (spec 0016 §6.2). Present
    // only on the list read, which is the one that computes the counts — a
    // create or update response says nothing, because nothing has changed about
    // what references it.
    ...(requirement.references === undefined
      ? {}
      : {
          deletable: Object.keys(requirement.references).length === 0,
          blockingReferences: requirement.references,
        }),
    createdAt: requirement.createdAt.toISOString(),
    updatedAt: requirement.updatedAt.toISOString(),
  };
}

export class ListConformityRequirementsUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  /**
   * `includeInactive` switches this from *a clinic's checklist source* to *the
   * admin catalogue* — two different questions with two different answers, and
   * the default stays the safe one.
   */
  async execute(input: { includeInactive?: boolean } = {}) {
    if (input.includeInactive) {
      const requirements = await this.deps.conformityRepository.findAllRequirements();
      return { data: requirements.map(serializeRequirementForAdmin) };
    }

    const requirements = await this.deps.conformityRepository.findActiveRequirements();

    return {
      data: requirements.map((requirement) => ({
        id: requirement.id,
        slug: requirement.slug,
        name: requirement.name,
        description: requirement.description ?? undefined,
        verticalId: requirement.verticalId ?? undefined,
        appliesToLegalDocumentType: requirement.appliesToLegalDocumentType ?? undefined,
        isActive: requirement.isActive,
        createdAt: requirement.createdAt.toISOString(),
      })),
    };
  }
}

/** Defaults matching the column defaults, so a short form is a complete one. */
const REQUIREMENT_DEFAULTS = {
  allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
  maxFiles: 10,
  maxFileSizeBytes: 52_428_800,
  maxCombinedSizeBytes: 209_715_200,
  requiresFrontAndBack: false,
  requiresValidityDate: false,
} as const;

/** `licença sanitária` → `licenca_sanitaria`. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Registers a document every clinic in scope must submit.
 *
 * ⚠️ **This is the most consequential write in the admin panel.** An active
 * requirement is immediately missing from every clinic it applies to, so
 * creating one moves the conformity of the whole base at once. Scope it with
 * `verticalId` and `appliesToLegalDocumentType` before activating it, or create
 * it inactive and turn it on deliberately.
 */
export class CreateConformityRequirementUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: {
    slug?: string;
    name: string;
    description?: string | null;
    verticalId?: number | null;
    appliesToLegalDocumentType?: FacilityLegalDocumentType | null;
    isActive?: boolean;
    allowedMimeTypes?: string[];
    maxFiles?: number;
    maxFileSizeBytes?: number;
    maxCombinedSizeBytes?: number;
    requiresFrontAndBack?: boolean;
    requiresValidityDate?: boolean;
  }) {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError([{ field: "name", message: "Name is required" }]);
    }
    const slug = (input.slug?.trim() || slugify(name)) || "";
    if (!slug) {
      throw new ValidationError([
        { field: "slug", message: "A slug could not be derived from this name" },
      ]);
    }
    const allowedMimeTypes =
      input.allowedMimeTypes ?? [...REQUIREMENT_DEFAULTS.allowedMimeTypes];
    if (allowedMimeTypes.length === 0) {
      throw new ValidationError([
        {
          field: "allowedMimeTypes",
          message: "At least one file type must be accepted",
        },
      ]);
    }

    const created = await this.deps.conformityRepository.createRequirement({
      slug,
      name,
      description: input.description ?? null,
      verticalId: input.verticalId ?? null,
      appliesToLegalDocumentType: input.appliesToLegalDocumentType ?? null,
      isActive: input.isActive ?? true,
      allowedMimeTypes,
      maxFiles: input.maxFiles ?? REQUIREMENT_DEFAULTS.maxFiles,
      maxFileSizeBytes: input.maxFileSizeBytes ?? REQUIREMENT_DEFAULTS.maxFileSizeBytes,
      maxCombinedSizeBytes:
        input.maxCombinedSizeBytes ?? REQUIREMENT_DEFAULTS.maxCombinedSizeBytes,
      requiresFrontAndBack:
        input.requiresFrontAndBack ?? REQUIREMENT_DEFAULTS.requiresFrontAndBack,
      requiresValidityDate:
        input.requiresValidityDate ?? REQUIREMENT_DEFAULTS.requiresValidityDate,
    });
    return serializeRequirementForAdmin(created);
  }
}

export class UpdateConformityRequirementUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(
    input: { id: number } & Partial<ConformityRequirementWritableFields>
  ) {
    const { id, ...fields } = input;
    if (fields.name !== undefined && !fields.name.trim()) {
      throw new ValidationError([{ field: "name", message: "Name is required" }]);
    }
    if (fields.allowedMimeTypes !== undefined && fields.allowedMimeTypes.length === 0) {
      throw new ValidationError([
        {
          field: "allowedMimeTypes",
          message: "At least one file type must be accepted",
        },
      ]);
    }

    const updated = await this.deps.conformityRepository.updateRequirement(id, fields);
    if (!updated) throw new ResourceNotFoundError("ConformityRequirement", id);
    return serializeRequirementForAdmin(updated);
  }
}

/**
 * Deletes a requirement no clinic has answered. Anything else is
 * `isActive = false` — spec 0016 §6.2, and both foreign keys are RESTRICT.
 */
export class DeleteConformityRequirementUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: { id: number }) {
    const outcome =
      await this.deps.conformityRepository.deleteRequirementIfUnanswered(input.id);
    if (!outcome.found) {
      throw new ResourceNotFoundError("ConformityRequirement", input.id);
    }
    if (!outcome.deleted) {
      throw new ResourceInUseError("ConformityRequirement", outcome.references);
    }
    return { id: input.id, deleted: true };
  }
}

export class ListFacilityConformityRecordsUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: { facilityId: number; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const records = await this.deps.conformityRepository.findRecordsByFacility(input.facilityId);

    return {
      data: records.map((record) => ({
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
        submittedAt: record.submittedAt?.toISOString(),
        validatedAt: record.validatedAt?.toISOString(),
        expiresAt: record.expiresAt?.toISOString(),
        validatedByUserId: record.validatedByUserId ?? undefined,
        url: record.url ?? undefined,
        contentType: record.contentType ?? undefined,
        fileName: record.fileName ?? undefined,
        reviewerNote: record.reviewerNote ?? undefined,
        createdAt: record.createdAt.toISOString(),
      })),
    };
  }
}

export class CreateFacilityConformityRecordUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: {
    facilityId: number;
    requirementId: number;
    scope: ScopeContext;
    status?: "PENDING" | "SUBMITTED";
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const record = await this.deps.conformityRepository.createRecord({
      facilityId: input.facilityId,
      requirementId: input.requirementId,
      status: input.status,
    });

    return {
      id: record.id,
      facilityId: record.facilityId,
      requirementId: record.requirementId,
      requirement: record.requirement,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
