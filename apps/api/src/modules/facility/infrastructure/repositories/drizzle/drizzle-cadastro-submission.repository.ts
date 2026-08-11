import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  conformityRequirements,
  documentFiles,
  fileAssets,
  processingEvents,
  reviewDecisions,
  submissionDocuments,
  uploadParts,
  uploadSessions,
  users,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type {
  CadastroSubmissionRepository,
  DocumentFileRecord,
  FileAssetRecord,
  SubmissionDocumentRecord,
  UploadSessionRecord,
} from "../../../application/interfaces/cadastro-submission.repository.interface";

function formatUserDisplayName(parts: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string | null {
  const full = [parts.firstName, parts.lastName]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(" ")
    .trim();
  if (full.length > 0) return full;
  const username = parts.username?.trim();
  return username && username.length > 0 ? username : null;
}

function mapDocument(
  row: typeof submissionDocuments.$inferSelect,
  requirement?: typeof conformityRequirements.$inferSelect
): SubmissionDocumentRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    facilityVerticalProfileId: row.facilityVerticalProfileId,
    requirementId: row.requirementId,
    title: row.title,
    status: row.status,
    version: row.version,
    reviewComment: row.reviewComment,
    validUntil: row.validUntil,
    submittedByUserId: row.submittedByUserId,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requirement: requirement
      ? {
          id: requirement.id,
          slug: requirement.slug,
          name: requirement.name,
          description: requirement.description,
          appliesToLegalDocumentType: requirement.appliesToLegalDocumentType,
          allowedMimeTypes: requirement.allowedMimeTypes ?? [],
          maxFiles: requirement.maxFiles,
          maxFileSizeBytes: requirement.maxFileSizeBytes,
          maxCombinedSizeBytes: requirement.maxCombinedSizeBytes,
          requiresFrontAndBack: requirement.requiresFrontAndBack,
          requiresValidityDate: requirement.requiresValidityDate,
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
    uploadedByUserId: row.uploadedByUserId,
    purgeAfter: row.purgeAfter,
    uploadedAt: row.uploadedAt,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDocumentFile(
  row: typeof documentFiles.$inferSelect,
  asset?: typeof fileAssets.$inferSelect,
  uploadedByName?: string | null
): DocumentFileRecord {
  return {
    uploadedByName: uploadedByName ?? null,
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
  async findDocumentById(id: number) {
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

  /**
   * The open attempt at a requirement, if there is one.
   *
   * APPROVED / REJECTED / SUPERSEDED are closed: a re-upload over any of them
   * opens a new version rather than mutating a reviewed row, which is what
   * keeps the history in `listDocumentsForFacilityRequirement` truthful.
   */
  async findWorkingDocument(input: {
    facilityId: number;
    requirementId: number;
  }) {
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
          eq(submissionDocuments.facilityId, input.facilityId),
          eq(submissionDocuments.requirementId, input.requirementId),
          inArray(submissionDocuments.status, [
            "DRAFT",
            "PROCESSING",
            "READY",
            "SUBMITTED",
            "UNDER_REVIEW",
            "CHANGES_REQUESTED",
          ])
        )
      )
      .orderBy(desc(submissionDocuments.version))
      .limit(1);
    return row ? mapDocument(row.document, row.requirement) : null;
  }

  async listDocumentsForReview(input: {
    status: SubmissionDocumentRecord["status"][];
    facilityIds?: number[];
    page: number;
    limit: number;
  }) {
    const conditions = [];
    if (input.status.length > 0) {
      conditions.push(inArray(submissionDocuments.status, input.status));
    }
    // Applied to both the page and the count, so the total matches what the
    // reviewer can actually open — a scoped total over an unscoped count would
    // paginate into pages that render empty.
    if (input.facilityIds !== undefined) {
      conditions.push(inArray(submissionDocuments.facilityId, input.facilityIds));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (input.page - 1) * input.limit;
    const [rows, totals] = await Promise.all([
      db
        .select({
          document: submissionDocuments,
          requirement: conformityRequirements,
          submittedByFirstName: users.firstName,
          submittedByLastName: users.lastName,
          submittedByUsername: users.username,
        })
        .from(submissionDocuments)
        .innerJoin(
          conformityRequirements,
          eq(submissionDocuments.requirementId, conformityRequirements.id)
        )
        .leftJoin(users, eq(submissionDocuments.submittedByUserId, users.id))
        .where(where)
        .orderBy(
          desc(submissionDocuments.submittedAt),
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
        facilityId: r.document.facilityId,
        submittedByName: formatUserDisplayName({
          firstName: r.submittedByFirstName,
          lastName: r.submittedByLastName,
          username: r.submittedByUsername,
        }),
      })),
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async listDocumentsForFacilityRequirement(input: {
    facilityId: number;
    requirementId: number;
    excludeDraft?: boolean;
  }) {
    const conditions = [
      eq(submissionDocuments.facilityId, input.facilityId),
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
      })
      .from(submissionDocuments)
      .innerJoin(
        conformityRequirements,
        eq(submissionDocuments.requirementId, conformityRequirements.id)
      )
      .where(and(...conditions))
      .orderBy(
        desc(submissionDocuments.version),
        desc(submissionDocuments.updatedAt)
      );
    return rows.map((r) => mapDocument(r.document, r.requirement));
  }

  async createDocument(input: {
    facilityId: number;
    facilityVerticalProfileId: number | null;
    requirementId: number;
    title: string;
    version?: number;
  }) {
    const [row] = await db
      .insert(submissionDocuments)
      .values({
        facilityId: input.facilityId,
        facilityVerticalProfileId: input.facilityVerticalProfileId,
        requirementId: input.requirementId,
        title: input.title,
        status: "DRAFT",
        ...(input.version !== undefined ? { version: input.version } : {}),
      })
      .returning();
    return this.findDocumentById(row!.id).then((d) => d!);
  }

  async deleteDocument(id: number) {
    await db.delete(submissionDocuments).where(eq(submissionDocuments.id, id));
  }

  async updateDocumentStatus(input: {
    id: number;
    status: SubmissionDocumentRecord["status"];
    reviewComment?: string | null;
    validUntil?: string | null;
    version?: number;
    submittedAt?: Date | null;
    submittedByUserId?: number | null;
  }) {
    await db
      .update(submissionDocuments)
      .set({
        status: input.status,
        ...(input.reviewComment !== undefined
          ? { reviewComment: input.reviewComment }
          : {}),
        ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.submittedAt !== undefined
          ? { submittedAt: input.submittedAt }
          : {}),
        ...(input.submittedByUserId !== undefined
          ? { submittedByUserId: input.submittedByUserId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(submissionDocuments.id, input.id));
    return this.findDocumentById(input.id).then((d) => d!);
  }

  async createFileAsset(input: {
    id?: number;
    facilityId: number;
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

  async findFileAssetById(id: number) {
    const [row] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, id))
      .limit(1);
    return row ? mapFileAsset(row) : null;
  }

  async deleteFileAsset(id: number) {
    await db.delete(fileAssets).where(eq(fileAssets.id, id));
  }

  async updateFileAsset(input: {
    id: number;
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

  async attachFileToDocument(input: {
    documentId: number;
    facilityId: number;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256?: string | null;
    role: DocumentFileRecord["role"];
    position?: number;
    maxFiles: number;
    maxCombinedSizeBytes: number;
    uploadedByUserId: number | null;
  }) {
    return db.transaction(async (tx) => {
      // The lock is on the parent document because that is the scope of every
      // quantity below: the file count, the combined size and the position
      // sequence are all per-document. Concurrent uploads into *different*
      // documents never touch the same row and do not contend.
      const [document] = await tx
        .select({ id: submissionDocuments.id })
        .from(submissionDocuments)
        .where(eq(submissionDocuments.id, input.documentId))
        .for("update");

      if (!document) return { outcome: "document_missing" as const };

      // One pass for all three quantities, inside the lock, so they cannot
      // disagree with each other or go stale before the insert.
      const [totals] = await tx
        .select({
          files: count(),
          combinedSize: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)`,
          maxPosition: sql<number>`coalesce(max(${documentFiles.position}), 0)`,
        })
        .from(documentFiles)
        .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
        .where(eq(documentFiles.submissionDocumentId, input.documentId));

      const currentFiles = Number(totals?.files ?? 0);
      const currentSize = Number(totals?.combinedSize ?? 0);

      if (currentFiles >= input.maxFiles) {
        return { outcome: "max_files_exceeded" as const };
      }
      if (currentSize + input.sizeBytes > input.maxCombinedSizeBytes) {
        return { outcome: "max_combined_size_exceeded" as const };
      }

      const [assetRow] = await tx
        .insert(fileAssets)
        .values({
          facilityId: input.facilityId,
          bucket: input.bucket,
          objectKey: input.objectKey,
          originalFilename: input.originalFilename,
          declaredMimeType: input.declaredMimeType,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256 ?? null,
          status: "PENDING_UPLOAD",
          uploadedByUserId: input.uploadedByUserId,
        })
        .returning();

      const position = input.position ?? Number(totals?.maxPosition ?? 0) + 1;

      await tx.insert(documentFiles).values({
        submissionDocumentId: input.documentId,
        fileAssetId: assetRow!.id,
        position,
        role: input.role,
      });

      return {
        outcome: "attached" as const,
        asset: mapFileAsset(assetRow!),
        position,
      };
    });
  }

  async listDocumentFiles(documentId: number) {
    const rows = await db
      .select({
        link: documentFiles,
        asset: fileAssets,
        uploaderFirstName: users.firstName,
        uploaderLastName: users.lastName,
        uploaderUsername: users.username,
      })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      // Left, not inner: a file whose uploader was deleted, or one uploaded
      // before attribution existed, must still appear in the checklist.
      .leftJoin(users, eq(fileAssets.uploadedByUserId, users.id))
      .where(eq(documentFiles.submissionDocumentId, documentId))
      .orderBy(documentFiles.position);
    return rows.map((r) =>
      mapDocumentFile(
        r.link,
        r.asset,
        formatUserDisplayName({
          firstName: r.uploaderFirstName,
          lastName: r.uploaderLastName,
          username: r.uploaderUsername,
        })
      )
    );
  }

  async setPurgeAfterForDocument(input: {
    documentId: number;
    purgeAfter: Date | null;
  }) {
    // Scoped through the link table so only this document's files are touched;
    // a facility-scoped asset shared by two documents is not collateral.
    const links = await db
      .select({ fileAssetId: documentFiles.fileAssetId })
      .from(documentFiles)
      .where(eq(documentFiles.submissionDocumentId, input.documentId));
    if (links.length === 0) return;

    await db
      .update(fileAssets)
      .set({ purgeAfter: input.purgeAfter })
      .where(inArray(fileAssets.id, links.map((l) => l.fileAssetId)));
  }

  async findDocumentFileByFileAssetId(fileAssetId: number) {
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
    submissionDocumentId: number;
    fileAssetId: number;
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

  async deleteDocumentFileByFileAssetId(fileAssetId: number) {
    await db
      .delete(documentFiles)
      .where(eq(documentFiles.fileAssetId, fileAssetId));
    await db.delete(fileAssets).where(eq(fileAssets.id, fileAssetId));
  }

  async reorderDocumentFiles(input: {
    submissionDocumentId: number;
    ordered: Array<{
      fileAssetId: number;
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

  async sumDocumentFileSizes(documentId: number) {
    const [row] = await db
      .select({
        value: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)`,
      })
      .from(documentFiles)
      .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
      .where(eq(documentFiles.submissionDocumentId, documentId));
    return Number(row?.value ?? 0);
  }

  async countDocumentFiles(documentId: number) {
    const [row] = await db
      .select({ value: count() })
      .from(documentFiles)
      .where(eq(documentFiles.submissionDocumentId, documentId));
    return Number(row?.value ?? 0);
  }

  async nextDocumentFilePosition(documentId: number) {
    const [row] = await db
      .select({
        value: sql<number>`coalesce(max(${documentFiles.position}), 0)`,
      })
      .from(documentFiles)
      .where(eq(documentFiles.submissionDocumentId, documentId));
    return Number(row?.value ?? 0) + 1;
  }

  async createUploadSession(input: {
    fileAssetId: number;
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

  async findUploadSessionById(id: number) {
    const [row] = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id))
      .limit(1);
    return row ? mapUploadSession(row) : null;
  }

  async updateUploadSession(input: {
    id: number;
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
    uploadSessionId: number;
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
    submissionDocumentId: number;
    reviewerId: number;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    reasonCode?: string | null;
    comment?: string | null;
    documentVersion: number;
    flaggedFileAssetIds?: number[];
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
    fileAssetId: number;
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
