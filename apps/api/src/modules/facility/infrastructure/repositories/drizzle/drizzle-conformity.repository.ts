import {
  conformityRecords,
  conformityRequirements,
  facilities,
  type Database,
  type FacilityLegalDocumentType,
} from "@atlasmed/database";
import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  ConformityRecordRow,
  ConformityRecordStatus,
  ConformityRepository,
  ConformityRequirementRecord,
} from "../../../application/interfaces/conformity.repository.interface";
import { ResourceNotFoundError } from "../../../../../shared/errors";

type RequirementRow = typeof conformityRequirements.$inferSelect;

function mapRequirement(row: RequirementRow): ConformityRequirementRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    verticalId: row.verticalId,
    appliesToLegalDocumentType:
      (row.appliesToLegalDocumentType as FacilityLegalDocumentType | null) ?? null,
    isActive: row.isActive,
    allowedMimeTypes: row.allowedMimeTypes ?? [],
    maxFiles: row.maxFiles,
    maxFileSizeBytes: row.maxFileSizeBytes,
    maxCombinedSizeBytes: row.maxCombinedSizeBytes,
    requiresFrontAndBack: row.requiresFrontAndBack,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const recordWithRequirementSelect = {
  id: conformityRecords.id,
  facilityId: conformityRecords.facilityId,
  requirementId: conformityRecords.requirementId,
  status: conformityRecords.status,
  submittedAt: conformityRecords.submittedAt,
  validatedAt: conformityRecords.validatedAt,
  expiresAt: conformityRecords.expiresAt,
  validatedByUserId: conformityRecords.validatedByUserId,
  storageKey: conformityRecords.storageKey,
  url: conformityRecords.url,
  contentType: conformityRecords.contentType,
  fileName: conformityRecords.fileName,
  reviewerNote: conformityRecords.reviewerNote,
  createdAt: conformityRecords.createdAt,
  updatedAt: conformityRecords.updatedAt,
  requirement: {
    id: conformityRequirements.id,
    slug: conformityRequirements.slug,
    name: conformityRequirements.name,
    description: conformityRequirements.description,
    appliesToLegalDocumentType: conformityRequirements.appliesToLegalDocumentType,
  },
} as const;

type RecordWithRequirement = {
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
};

function mapRecord(row: RecordWithRequirement): ConformityRecordRow {
  return {
    id: row.id,
    facilityId: row.facilityId,
    requirementId: row.requirementId,
    status: row.status,
    submittedAt: row.submittedAt,
    validatedAt: row.validatedAt,
    expiresAt: row.expiresAt,
    validatedByUserId: row.validatedByUserId,
    storageKey: row.storageKey,
    url: row.url,
    contentType: row.contentType,
    fileName: row.fileName,
    reviewerNote: row.reviewerNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requirement: {
      id: row.requirement.id,
      slug: row.requirement.slug,
      name: row.requirement.name,
      description: row.requirement.description,
      appliesToLegalDocumentType:
        (row.requirement.appliesToLegalDocumentType as FacilityLegalDocumentType | null) ??
        null,
    },
    facility: row.facility,
  };
}

async function loadRecordById(
  database: Database,
  id: number
): Promise<ConformityRecordRow | null> {
  const [record] = await database
    .select(recordWithRequirementSelect)
    .from(conformityRecords)
    .innerJoin(
      conformityRequirements,
      eq(conformityRecords.requirementId, conformityRequirements.id)
    )
    .where(eq(conformityRecords.id, id));

  return record ? mapRecord(record) : null;
}

export class DrizzleConformityRepository implements ConformityRepository {
  /**
   * Injectable so a test can hand it a transaction, matching
   * DrizzleFacilityPurchaseRecurrenceRepository. Without it these queries can
   * only be exercised against committed rows.
   */
  constructor(private readonly database: Database = db) {}

  async findActiveRequirements(params?: {
    legalDocumentType?: FacilityLegalDocumentType | null;
    /**
     * Restrict to requirements that apply to this vertical (D-49).
     *
     * `conformity_requirements.vertical_id` existed but was never read, so a
     * clinic's cadastro checklist listed every vertical's documents — including
     * ones its linha does not require. Omitted (admin catalogue) means no
     * vertical filter at all.
     */
    verticalId?: number | null;
  }): Promise<ConformityRequirementRecord[]> {
    // No params → full active catalog (admin list).
    // Explicit null/unknown legal type → empty; the caller must establish whether
    // the clinic is a CNPJ or a CPF before a checklist means anything.
    if (
      params !== undefined &&
      params.legalDocumentType !== "CNPJ" &&
      params.legalDocumentType !== "CPF"
    ) {
      return [];
    }

    const conditions = [eq(conformityRequirements.isActive, true)];

    // ADR 0007: a null scope column means "applies to everyone", for BOTH scope
    // columns. This one used to exclude nulls, to stop legacy shared rows from
    // reaching checklists — but those rows no longer exist, and having null mean
    // "everyone" for vertical_id while meaning "nobody" here is a trap for
    // whoever adds the next requirement.
    if (params !== undefined) {
      conditions.push(
        or(
          isNull(conformityRequirements.appliesToLegalDocumentType),
          eq(
            conformityRequirements.appliesToLegalDocumentType,
            params.legalDocumentType!
          )
        )!
      );
    }

    // Same rule for the vertical (spec 0011 §3.2): a null vertical_id is
    // facility-scoped — satisfied once, counting for every linha — while a set
    // one belongs to that linha alone.
    if (params?.verticalId != null) {
      conditions.push(
        or(
          isNull(conformityRequirements.verticalId),
          eq(conformityRequirements.verticalId, params.verticalId)
        )!
      );
    }

    const rows = await this.database
      .select()
      .from(conformityRequirements)
      .where(and(...conditions))
      .orderBy(asc(conformityRequirements.name));

    return rows.map(mapRequirement);
  }

  async findRequirementById(id: number): Promise<ConformityRequirementRecord | null> {
    const [row] = await this.database
      .select()
      .from(conformityRequirements)
      .where(eq(conformityRequirements.id, id))
      .limit(1);

    return row ? mapRequirement(row) : null;
  }

  async findRecordsByFacility(facilityId: number): Promise<ConformityRecordRow[]> {
    const rows = await this.database
      .select(recordWithRequirementSelect)
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .where(eq(conformityRecords.facilityId, facilityId))
      .orderBy(desc(conformityRecords.createdAt));

    return rows.map(mapRecord);
  }

  async findRecordById(id: number): Promise<ConformityRecordRow | null> {
    return loadRecordById(this.database, id);
  }

  async findRecordByFacilityAndRequirement(
    facilityId: number,
    requirementId: number
  ): Promise<ConformityRecordRow | null> {
    const [record] = await this.database
      .select(recordWithRequirementSelect)
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .where(
        and(
          eq(conformityRecords.facilityId, facilityId),
          eq(conformityRecords.requirementId, requirementId)
        )
      )
      .limit(1);

    return record ? mapRecord(record) : null;
  }

  async findRecordByStorageKey(
    storageKey: string
  ): Promise<ConformityRecordRow | null> {
    const [record] = await this.database
      .select(recordWithRequirementSelect)
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .where(eq(conformityRecords.storageKey, storageKey))
      .limit(1);

    return record ? mapRecord(record) : null;
  }

  async findSubmittedRecords(params: {
    status: ConformityRecordStatus;
    page: number;
    limit: number;
  }): Promise<{ records: ConformityRecordRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(conformityRecords)
      .where(eq(conformityRecords.status, params.status));

    const rows = await this.database
      .select({
        ...recordWithRequirementSelect,
        facility: {
          id: facilities.id,
          name: facilities.displayName,
          legalDocumentType: facilities.legalDocumentType,
        },
      })
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .innerJoin(facilities, eq(conformityRecords.facilityId, facilities.id))
      .where(eq(conformityRecords.status, params.status))
      .orderBy(desc(conformityRecords.submittedAt), desc(conformityRecords.createdAt))
      .limit(params.limit)
      .offset(offset);

    return {
      records: rows.map((row) =>
        mapRecord({
          ...row,
          facility: {
            id: row.facility.id,
            name: row.facility.name,
            legalDocumentType:
              (row.facility.legalDocumentType as FacilityLegalDocumentType | null) ??
              null,
          },
        })
      ),
      total: totalRow?.total ?? 0,
    };
  }

  async createRecord(params: {
    facilityId: number;
    requirementId: number;
    status?: ConformityRecordStatus;
  }): Promise<ConformityRecordRow> {
    const [inserted] = await this.database
      .insert(conformityRecords)
      .values({
        facilityId: params.facilityId,
        requirementId: params.requirementId,
        status: params.status ?? "PENDING",
      })
      .returning({ id: conformityRecords.id });

    const record = await loadRecordById(this.database, inserted!.id);
    if (!record) {
      throw new ResourceNotFoundError("ConformityRecord", inserted!.id);
    }
    return record;
  }

  async upsertSubmittedRecord(params: {
    facilityId: number;
    requirementId: number;
    storageKey: string;
    url: string;
    contentType: string;
    fileName: string;
  }): Promise<ConformityRecordRow> {
    const now = new Date();
    const [upserted] = await this.database
      .insert(conformityRecords)
      .values({
        facilityId: params.facilityId,
        requirementId: params.requirementId,
        status: "SUBMITTED",
        submittedAt: now,
        validatedAt: null,
        validatedByUserId: null,
        storageKey: params.storageKey,
        url: params.url,
        contentType: params.contentType,
        fileName: params.fileName,
        reviewerNote: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [conformityRecords.facilityId, conformityRecords.requirementId],
        set: {
          status: "SUBMITTED",
          submittedAt: now,
          validatedAt: null,
          validatedByUserId: null,
          storageKey: params.storageKey,
          url: params.url,
          contentType: params.contentType,
          fileName: params.fileName,
          reviewerNote: null,
          updatedAt: now,
        },
      })
      .returning({ id: conformityRecords.id });

    const record = await loadRecordById(this.database, upserted!.id);
    if (!record) {
      throw new ResourceNotFoundError("ConformityRecord", upserted!.id);
    }
    return record;
  }

  async approveRecord(params: {
    recordId: number;
    validatedByUserId: number;
  }): Promise<ConformityRecordRow> {
    const now = new Date();
    const [updated] = await this.database
      .update(conformityRecords)
      .set({
        status: "VALIDATED",
        validatedAt: now,
        validatedByUserId: params.validatedByUserId,
        reviewerNote: null,
        updatedAt: now,
      })
      .where(eq(conformityRecords.id, params.recordId))
      .returning({ id: conformityRecords.id });

    if (!updated) {
      throw new ResourceNotFoundError("ConformityRecord", params.recordId);
    }

    const record = await loadRecordById(this.database, updated.id);
    if (!record) {
      throw new ResourceNotFoundError("ConformityRecord", params.recordId);
    }
    return record;
  }

  async rejectRecord(params: {
    recordId: number;
    validatedByUserId: number;
    reviewerNote: string;
  }): Promise<ConformityRecordRow> {
    const now = new Date();
    const [updated] = await this.database
      .update(conformityRecords)
      .set({
        status: "REJECTED",
        validatedAt: now,
        validatedByUserId: params.validatedByUserId,
        reviewerNote: params.reviewerNote,
        updatedAt: now,
      })
      .where(eq(conformityRecords.id, params.recordId))
      .returning({ id: conformityRecords.id });

    if (!updated) {
      throw new ResourceNotFoundError("ConformityRecord", params.recordId);
    }

    const record = await loadRecordById(this.database, updated.id);
    if (!record) {
      throw new ResourceNotFoundError("ConformityRecord", params.recordId);
    }
    return record;
  }
}
