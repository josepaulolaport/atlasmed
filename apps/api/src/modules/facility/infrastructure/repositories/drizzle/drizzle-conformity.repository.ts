import {
  conformityRecords,
  conformityRequirements,
  facilities,
  submissionDocuments,
  type Database,
  type FacilityLegalDocumentType,
} from "@atlasmed/database";
import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  ConformityRecordRow,
  ConformityRecordStatus,
  ConformityRepository,
  ConformityRequirementDeletionOutcome,
  ConformityRequirementReferences,
  ConformityRequirementRecord,
  ConformityRequirementWritableFields,
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
    requiresValidityDate: row.requiresValidityDate,
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

  // ── Admin writes (spec 0016 §4.7) ───────────────────────────────────
  // Kept beside the reads rather than in their own repository: the read below
  // *is* a clinic's checklist and these are what fills it, so splitting them
  // would let the two disagree about what a requirement is.

  /**
   * The whole catalogue, active and inactive — the admin list only.
   *
   * Separate from `findActiveRequirements` rather than a flag on it, because a
   * retired requirement leaking into a checklist would ask a rep for a document
   * nobody wants any more.
   */
  async findAllRequirements(): Promise<ConformityRequirementRecord[]> {
    /*
     * The reference counts come back with the rows so the admin form can
     * disable delete with a reason rather than promise one the API refuses.
     *
     * Three grouped queries joined in memory, not correlated subqueries in the
     * select list: the first attempt wrote the subquery inline and it did not
     * correlate — every row came back with the table-wide total, so a catalogue
     * where one requirement had a single answer reported all five as blocked.
     * Caught on the simulator. This shape cannot express that mistake, and the
     * catalogue is five rows.
     */
    const [rows, recordCounts, documentCounts] = await Promise.all([
      this.database
        .select()
        .from(conformityRequirements)
        .orderBy(asc(conformityRequirements.name)),
      this.database
        .select({
          requirementId: conformityRecords.requirementId,
          total: count(),
        })
        .from(conformityRecords)
        .groupBy(conformityRecords.requirementId),
      this.database
        .select({
          requirementId: submissionDocuments.requirementId,
          total: count(),
        })
        .from(submissionDocuments)
        .groupBy(submissionDocuments.requirementId),
    ]);

    const recordsById = new Map(recordCounts.map((r) => [r.requirementId, r.total]));
    const documentsById = new Map(
      documentCounts.map((r) => [r.requirementId, r.total])
    );

    return rows.map((row) => {
      const references: ConformityRequirementReferences = {};
      const records = recordsById.get(row.id) ?? 0;
      const documents = documentsById.get(row.id) ?? 0;
      if (records > 0) references.conformityRecords = records;
      if (documents > 0) references.submissionDocuments = documents;
      return { ...mapRequirement(row), references };
    });
  }

  async createRequirement(
    data: ConformityRequirementWritableFields & { slug: string }
  ): Promise<ConformityRequirementRecord> {
    const [row] = await this.database
      .insert(conformityRequirements)
      .values({
        slug: data.slug,
        name: data.name,
        description: data.description,
        verticalId: data.verticalId,
        appliesToLegalDocumentType: data.appliesToLegalDocumentType,
        isActive: data.isActive,
        allowedMimeTypes: data.allowedMimeTypes,
        maxFiles: data.maxFiles,
        maxFileSizeBytes: data.maxFileSizeBytes,
        maxCombinedSizeBytes: data.maxCombinedSizeBytes,
        requiresFrontAndBack: data.requiresFrontAndBack,
        requiresValidityDate: data.requiresValidityDate,
      })
      .returning();
    return mapRequirement(row!);
  }

  /**
   * `slug` cannot arrive here — it is absent from
   * [ConformityRequirementWritableFields] by design. It is the key every
   * cadastro DTO travels under, so it is chosen once and `name` is the label to
   * change instead.
   */
  async updateRequirement(
    id: number,
    data: Partial<ConformityRequirementWritableFields>
  ): Promise<ConformityRequirementRecord | null> {
    const values = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    // An empty `SET` is a syntax error rather than a no-op.
    if (Object.keys(values).length === 0) {
      return this.findRequirementById(id);
    }

    const [row] = await this.database
      .update(conformityRequirements)
      .set(values)
      .where(eq(conformityRequirements.id, id))
      .returning();
    return row ? mapRequirement(row) : null;
  }

  /**
   * Deletes a requirement, but only while no clinic has answered it.
   *
   * Both referencing foreign keys are `ON DELETE RESTRICT`, so the alternative
   * is a bare 23503 the admin cannot act on. The row is locked before it is
   * counted for the same reason the product delete locks (spec 0016 §6.2):
   * otherwise a clinic submitting between the count and the delete decides the
   * outcome.
   */
  async deleteRequirementIfUnanswered(
    id: number
  ): Promise<ConformityRequirementDeletionOutcome> {
    return this.database.transaction(async (tx) => {
      const locked = await tx
        .select({ id: conformityRequirements.id })
        .from(conformityRequirements)
        .where(eq(conformityRequirements.id, id))
        .for("update");
      if (!locked[0]) return { found: false };

      const [counts] = await tx
        .select({
          records: sql<string>`(
            select count(*) from ${conformityRecords}
            where ${conformityRecords.requirementId} = ${id}
          )`,
          documents: sql<string>`(
            select count(*) from ${submissionDocuments}
            where ${submissionDocuments.requirementId} = ${id}
          )`,
        })
        .from(conformityRequirements)
        .where(eq(conformityRequirements.id, id))
        .limit(1);

      const references: ConformityRequirementReferences = {};
      if (Number(counts?.records ?? 0) > 0) {
        references.conformityRecords = Number(counts!.records);
      }
      if (Number(counts?.documents ?? 0) > 0) {
        references.submissionDocuments = Number(counts!.documents);
      }
      if (Object.keys(references).length > 0) {
        return { found: true, deleted: false, references };
      }

      await tx
        .delete(conformityRequirements)
        .where(eq(conformityRequirements.id, id));
      return { found: true, deleted: true };
    });
  }

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
