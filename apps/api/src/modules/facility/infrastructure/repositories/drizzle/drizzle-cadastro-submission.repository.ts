import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  cadastroSubmissions,
  conformityRequirements,
  documentFiles,
  fileAssets,
  processingEvents,
  reviewDecisions,
  submissionDocuments,
  uploadParts,
  uploadSessions,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type {
  CadastroSubmissionRecord,
  CadastroSubmissionRepository,
  DocumentFileRecord,
  FileAssetRecord,
  SubmissionDocumentRecord,
  UploadSessionRecord,
} from "../../../application/interfaces/cadastro-submission.repository.interface";

function mapSubmission(
  row: typeof cadastroSubmissions.$inferSelect
): CadastroSubmissionRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    submittedByUserId: row.submittedByUserId,
    status: row.status,
    version: row.version,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDocument(
  row: typeof submissionDocuments.$inferSelect,
  requirement?: typeof conformityRequirements.$inferSelect
): SubmissionDocumentRecord {
  return {
    id: row.id,
    submissionId: row.submissionId,
    requirementId: row.requirementId,
    title: row.title,
    status: row.status,
    version: row.version,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requirement: requirement
      ? {
          id: requirement.id,
          slug: requirement.slug,
          name: requirement.name,
          description: requirement.description,
          appliesToTaxIdType: requirement.appliesToTaxIdType,
          allowedMimeTypes: requirement.allowedMimeTypes ?? [],
          maxFiles: requirement.maxFiles,
          maxFileSizeBytes: requirement.maxFileSizeBytes,
          maxCombinedSizeBytes: requirement.maxCombinedSizeBytes,
          requiresFrontAndBack: requirement.requiresFrontAndBack,
        }
      : undefined,
  };
}

function mapFileAsset(row: typeof fileAssets.$inferSelect): FileAssetRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    storageProvider: row.storageProvider,
    bucket: row.bucket,
    objectKey: row.objectKey,
    thumbObjectKey: row.thumbObjectKey,
    previewObjectKey: row.previewObjectKey,
    originalFilename: row.originalFilename,
    declaredMimeType: row.declaredMimeType,
    detectedMimeType: row.detectedMimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    status: row.status,
    pageCount: row.pageCount,
    width: row.width,
    height: row.height,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    uploadedAt: row.uploadedAt,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDocumentFile(
  row: typeof documentFiles.$inferSelect,
  asset?: typeof fileAssets.$inferSelect
): DocumentFileRecord {
  return {
    id: row.id,
    submissionDocumentId: row.submissionDocumentId,
    fileAssetId: row.fileAssetId,
    position: row.position,
    role: row.role,
    createdAt: row.createdAt,
    fileAsset: asset ? mapFileAsset(asset) : undefined,
  };
}

function mapUploadSession(
  row: typeof uploadSessions.$inferSelect
): UploadSessionRecord {
  return {
    id: row.id,
    fileAssetId: row.fileAssetId,
    storageUploadId: row.storageUploadId,
    status: row.status,
    partSize: row.partSize,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export class DrizzleCadastroSubmissionRepository
  implements CadastroSubmissionRepository
{
  async findDraftByFacility(facilityId: string) {
    const [row] = await db
      .select()
      .from(cadastroSubmissions)
      .where(
        and(
          eq(cadastroSubmissions.facilityId, facilityId),
          eq(cadastroSubmissions.status, "DRAFT")
        )
      )
      .limit(1);
    return row ? mapSubmission(row) : null;
  }

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(cadastroSubmissions)
      .where(eq(cadastroSubmissions.id, id))
      .limit(1);
    return row ? mapSubmission(row) : null;
  }

  async findLatestByFacility(facilityId: string) {
    const [row] = await db
      .select()
      .from(cadastroSubmissions)
      .where(eq(cadastroSubmissions.facilityId, facilityId))
      .orderBy(desc(cadastroSubmissions.version))
      .limit(1);
    return row ? mapSubmission(row) : null;
  }

  async createSubmission(input: {
    facilityId: string;
    submittedByUserId?: string | null;
    version: number;
  }) {
    const [row] = await db
      .insert(cadastroSubmissions)
      .values({
        facilityId: input.facilityId,
        submittedByUserId: input.submittedByUserId ?? null,
        version: input.version,
        status: "DRAFT",
      })
      .returning();
    return mapSubmission(row!);
  }

  async updateSubmissionStatus(input: {
    id: string;
    status: CadastroSubmissionRecord["status"];
    submittedAt?: Date | null;
    submittedByUserId?: string | null;
  }) {
    const [row] = await db
      .update(cadastroSubmissions)
      .set({
        status: input.status,
        ...(input.submittedAt !== undefined
          ? { submittedAt: input.submittedAt }
          : {}),
        ...(input.submittedByUserId !== undefined
          ? { submittedByUserId: input.submittedByUserId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(cadastroSubmissions.id, input.id))
      .returning();
    return mapSubmission(row!);
  }

  async deleteSubmission(id: string) {
    await db.delete(cadastroSubmissions).where(eq(cadastroSubmissions.id, id));
  }

  async listSubmissions(input: {
    status?: CadastroSubmissionRecord["status"][];
    page: number;
    limit: number;
  }) {
    const where =
      input.status && input.status.length > 0
        ? inArray(cadastroSubmissions.status, input.status)
        : undefined;
    const offset = (input.page - 1) * input.limit;
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(cadastroSubmissions)
        .where(where)
        .orderBy(desc(cadastroSubmissions.updatedAt))
        .limit(input.limit)
        .offset(offset),
      db.select({ value: count() }).from(cadastroSubmissions).where(where),
    ]);
    return {
      items: rows.map(mapSubmission),
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async findDocumentById(id: string) {
    const [row] = await db
      .select({
        document: submissionDocuments,
        requirement: conformityRequirements,
      })
      .from(submissionDocuments)
      .innerJoin(
        conformityRequirements,
        eq(submissionDocuments.requirementId, conformityRequirements.id)
      )
      .where(eq(submissionDocuments.id, id))
      .limit(1);
    return row ? mapDocument(row.document, row.requirement) : null;
  }

  async findDocumentsBySubmission(submissionId: string) {
    const rows = await db
      .select({
        document: submissionDocuments,
        requirement: conformityRequirements,
      })
      .from(submissionDocuments)
      .innerJoin(
        conformityRequirements,
        eq(submissionDocuments.requirementId, conformityRequirements.id)
      )
      .where(eq(submissionDocuments.submissionId, submissionId));
    return rows.map((r) => mapDocument(r.document, r.requirement));
  }

  async findDocumentBySubmissionAndRequirement(
    submissionId: string,
    requirementId: string
  ) {
    const [row] = await db
      .select({
        document: submissionDocuments,
        requirement: conformityRequirements,
      })
      .from(submissionDocuments)
      .innerJoin(
        conformityRequirements,
        eq(submissionDocuments.requirementId, conformityRequirements.id)
      )
      .where(
        and(
          eq(submissionDocuments.submissionId, submissionId),
          eq(submissionDocuments.requirementId, requirementId)
        )
      )
      .limit(1);
    return row ? mapDocument(row.document, row.requirement) : null;
  }

  async listDocumentsForReview(input: {
    status: SubmissionDocumentRecord["status"][];
    page: number;
    limit: number;
  }) {
    const where =
      input.status.length > 0
        ? inArray(submissionDocuments.status, input.status)
        : undefined;
    const offset = (input.page - 1) * input.limit;
    const [rows, totals] = await Promise.all([
      db
        .select({
          document: submissionDocuments,
          requirement: conformityRequirements,
          submission: cadastroSubmissions,
        })
        .from(submissionDocuments)
        .innerJoin(
          cadastroSubmissions,
          eq(submissionDocuments.submissionId, cadastroSubmissions.id)
        )
        .innerJoin(
          conformityRequirements,
          eq(submissionDocuments.requirementId, conformityRequirements.id)
        )
        .where(where)
        .orderBy(
          desc(cadastroSubmissions.submittedAt),
          desc(submissionDocuments.updatedAt)
        )
        .limit(input.limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(submissionDocuments)
        .where(where),
    ]);
    return {
      items: rows.map((r) => ({
        document: mapDocument(r.document, r.requirement),
        submission: mapSubmission(r.submission),
      })),
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async listDocumentsForFacilityRequirement(input: {
    facilityId: string;
    requirementId: string;
    excludeDraft?: boolean;
  }) {
    const conditions = [
      eq(cadastroSubmissions.facilityId, input.facilityId),
      eq(submissionDocuments.requirementId, input.requirementId),
    ];
    if (input.excludeDraft) {
      // History / ops "envios" = actually submitted for review (not upload-ready drafts).
      conditions.push(
        inArray(submissionDocuments.status, [
          "SUBMITTED",
          "UNDER_REVIEW",
          "APPROVED",
          "REJECTED",
          "CHANGES_REQUESTED",
          "SUPERSEDED",
        ])
      );
    }
    const rows = await db
      .select({
        document: submissionDocuments,
        requirement: conformityRequirements,
        submission: cadastroSubmissions,
      })
      .from(submissionDocuments)
      .innerJoin(
        cadastroSubmissions,
        eq(submissionDocuments.submissionId, cadastroSubmissions.id)
      )
      .innerJoin(
        conformityRequirements,
        eq(submissionDocuments.requirementId, conformityRequirements.id)
      )
      .where(and(...conditions))
      .orderBy(
        desc(cadastroSubmissions.submittedAt),
        desc(cadastroSubmissions.version),
        desc(submissionDocuments.updatedAt)
      );
    return rows.map((r) => ({
      document: mapDocument(r.document, r.requirement),
      submission: mapSubmission(r.submission),
    }));
  }

  async createDocument(input: {
    submissionId: string;
    requirementId: string;
    title: string;
  }) {
    const [row] = await db
      .insert(submissionDocuments)
      .values({
        submissionId: input.submissionId,
        requirementId: input.requirementId,
        title: input.title,
        status: "DRAFT",
      })
      .returning();
    return this.findDocumentById(row!.id).then((d) => d!);
  }

  async updateDocumentStatus(input: {
    id: string;
    status: SubmissionDocumentRecord["status"];
    reviewComment?: string | null;
    version?: number;
  }) {
    await db
      .update(submissionDocuments)
      .set({
        status: input.status,
        ...(input.reviewComment !== undefined
          ? { reviewComment: input.reviewComment }
          : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        updatedAt: new Date(),
      })
      .where(eq(submissionDocuments.id, input.id));
    return this.findDocumentById(input.id).then((d) => d!);
  }

  async createFileAsset(input: {
    id?: string;
    facilityId: string;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256?: string | null;
    status?: FileAssetRecord["status"];
  }) {
    const [row] = await db
      .insert(fileAssets)
      .values({
        ...(input.id ? { id: input.id } : {}),
        facilityId: input.facilityId,
        bucket: input.bucket,
        objectKey: input.objectKey,
        originalFilename: input.originalFilename,
        declaredMimeType: input.declaredMimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256 ?? null,
        status: input.status ?? "PENDING_UPLOAD",
      })
      .returning();
    return mapFileAsset(row!);
  }

  async findFileAssetById(id: string) {
    const [row] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, id))
      .limit(1);
    return row ? mapFileAsset(row) : null;
  }

  async deleteFileAsset(id: string) {
    await db.delete(fileAssets).where(eq(fileAssets.id, id));
  }

  async updateFileAsset(input: {
    id: string;
    status?: FileAssetRecord["status"];
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
  }) {
    const { id, ...patch } = input;
    const [row] = await db
      .update(fileAssets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(fileAssets.id, id))
      .returning();
    return mapFileAsset(row!);
  }

  async listDocumentFiles(documentId: string) {
    const rows = await db
      .select({
        link: documentFiles,
        asset: fileAssets,
      })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      .where(eq(documentFiles.submissionDocumentId, documentId))
      .orderBy(documentFiles.position);
    return rows.map((r) => mapDocumentFile(r.link, r.asset));
  }

  async findDocumentFileByFileAssetId(fileAssetId: string) {
    const [row] = await db
      .select({
        link: documentFiles,
        asset: fileAssets,
      })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      .where(eq(documentFiles.fileAssetId, fileAssetId))
      .limit(1);
    return row ? mapDocumentFile(row.link, row.asset) : null;
  }

  async createDocumentFile(input: {
    submissionDocumentId: string;
    fileAssetId: string;
    position: number;
    role: DocumentFileRecord["role"];
  }) {
    const [row] = await db
      .insert(documentFiles)
      .values(input)
      .returning();
    const asset = await this.findFileAssetById(input.fileAssetId);
    return mapDocumentFile(row!, asset ?? undefined);
  }

  async reorderDocumentFiles(input: {
    submissionDocumentId: string;
    ordered: Array<{
      fileAssetId: string;
      position: number;
      role: DocumentFileRecord["role"];
    }>;
  }) {
    await db.transaction(async (tx) => {
      // Avoid unique position collisions while rewriting.
      await tx
        .update(documentFiles)
        .set({ position: sql`${documentFiles.position} + 1000` })
        .where(
          eq(documentFiles.submissionDocumentId, input.submissionDocumentId)
        );
      for (const item of input.ordered) {
        await tx
          .update(documentFiles)
          .set({ position: item.position, role: item.role })
          .where(
            and(
              eq(
                documentFiles.submissionDocumentId,
                input.submissionDocumentId
              ),
              eq(documentFiles.fileAssetId, item.fileAssetId)
            )
          );
      }
    });
    return this.listDocumentFiles(input.submissionDocumentId);
  }

  async sumDocumentFileSizes(documentId: string) {
    const [row] = await db
      .select({
        value: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)`,
      })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      .where(eq(documentFiles.submissionDocumentId, documentId));
    return Number(row?.value ?? 0);
  }

  async countDocumentFiles(documentId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(documentFiles)
      .where(eq(documentFiles.submissionDocumentId, documentId));
    return Number(row?.value ?? 0);
  }

  async createUploadSession(input: {
    fileAssetId: string;
    storageUploadId: string;
    partSize: number;
    expiresAt: Date;
  }) {
    const [row] = await db
      .insert(uploadSessions)
      .values({
        fileAssetId: input.fileAssetId,
        storageUploadId: input.storageUploadId,
        partSize: input.partSize,
        expiresAt: input.expiresAt,
        status: "PENDING",
      })
      .returning();
    return mapUploadSession(row!);
  }

  async findUploadSessionById(id: string) {
    const [row] = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id))
      .limit(1);
    return row ? mapUploadSession(row) : null;
  }

  async updateUploadSession(input: {
    id: string;
    status: UploadSessionRecord["status"];
    completedAt?: Date | null;
  }) {
    const [row] = await db
      .update(uploadSessions)
      .set({
        status: input.status,
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      })
      .where(eq(uploadSessions.id, input.id))
      .returning();
    return mapUploadSession(row!);
  }

  async upsertUploadPart(input: {
    uploadSessionId: string;
    partNumber: number;
    etag: string;
    sizeBytes?: number;
  }) {
    await db
      .insert(uploadParts)
      .values({
        uploadSessionId: input.uploadSessionId,
        partNumber: input.partNumber,
        etag: input.etag,
        sizeBytes: input.sizeBytes ?? null,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [uploadParts.uploadSessionId, uploadParts.partNumber],
        set: {
          etag: input.etag,
          sizeBytes: input.sizeBytes ?? null,
          completedAt: new Date(),
        },
      });
  }

  async createReviewDecision(input: {
    submissionDocumentId: string;
    reviewerId: string;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    reasonCode?: string | null;
    comment?: string | null;
    documentVersion: number;
    flaggedFileAssetIds?: string[];
  }) {
    await db.insert(reviewDecisions).values({
      submissionDocumentId: input.submissionDocumentId,
      reviewerId: input.reviewerId,
      decision: input.decision,
      reasonCode: input.reasonCode ?? null,
      comment: input.comment ?? null,
      documentVersion: input.documentVersion,
      flaggedFileAssetIds: input.flaggedFileAssetIds ?? [],
    });
  }

  async createProcessingEvent(input: {
    fileAssetId: string;
    processingStep: string;
    status: "STARTED" | "SUCCEEDED" | "FAILED";
    errorCode?: string | null;
    errorMessage?: string | null;
    attempt?: number;
  }) {
    await db.insert(processingEvents).values({
      fileAssetId: input.fileAssetId,
      processingStep: input.processingStep,
      status: input.status,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      attempt: input.attempt ?? 1,
    });
  }
}
