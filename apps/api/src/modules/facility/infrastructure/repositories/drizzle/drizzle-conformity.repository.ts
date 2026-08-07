import {
  conformityRecords,
  conformityRequirements,
  facilities,
  type FacilityLegalDocumentType,
} from "@atlasmed/database";
import { and, asc, count, desc, eq } from "drizzle-orm";
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

async function loadRecordById(id: number): Promise<ConformityRecordRow | null> {
  const [record] = await db
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
  async findActiveRequirements(params?: {
    legalDocumentType?: FacilityLegalDocumentType | null;
  }): Promise<ConformityRequirementRecord[]> {
    // No params → full active catalog (admin list).
    // Explicit legalDocumentType CNPJ/CPF → ONLY that catalog (no shared/null rows —
    // legacy shared requirements must not appear in Cadastro checklists).
    // Explicit null/unknown → empty (caller should set legalDocumentType first).
    if (
      params !== undefined &&
      params.legalDocumentType !== "CNPJ" &&
      params.legalDocumentType !== "CPF"
    ) {
      return [];
    }

    const typeFilter =
      params === undefined
        ? undefined
        : eq(
            conformityRequirements.appliesToLegalDocumentType,
            params.legalDocumentType!
          );

    const rows = await db
      .select()
      .from(conformityRequirements)
      .where(
        typeFilter
          ? and(eq(conformityRequirements.isActive, true), typeFilter)
          : eq(conformityRequirements.isActive, true)
      )
      .orderBy(asc(conformityRequirements.name));

    return rows.map(mapRequirement);
  }

  async findRequirementById(id: number): Promise<ConformityRequirementRecord | null> {
    const [row] = await db
      .select()
      .from(conformityRequirements)
      .where(eq(conformityRequirements.id, id))
      .limit(1);

    return row ? mapRequirement(row) : null;
  }

  async findRecordsByFacility(facilityId: number): Promise<ConformityRecordRow[]> {
    const rows = await db
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
    return loadRecordById(id);
  }

  async findRecordByFacilityAndRequirement(
    facilityId: number,
    requirementId: number
  ): Promise<ConformityRecordRow | null> {
    const [record] = await db
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
    const [record] = await db
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

    const [totalRow] = await db
      .select({ total: count() })
      .from(conformityRecords)
      .where(eq(conformityRecords.status, params.status));

    const rows = await db
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
    const [inserted] = await db
      .insert(conformityRecords)
      .values({
        facilityId: params.facilityId,
        requirementId: params.requirementId,
        status: params.status ?? "PENDING",
      })
      .returning({ id: conformityRecords.id });

    const record = await loadRecordById(inserted!.id);
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
    const [upserted] = await db
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

    const record = await loadRecordById(upserted!.id);
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
    const [updated] = await db
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

    const record = await loadRecordById(updated.id);
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
    const [updated] = await db
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

    const record = await loadRecordById(updated.id);
    if (!record) {
      throw new ResourceNotFoundError("ConformityRecord", params.recordId);
    }
    return record;
  }
}
