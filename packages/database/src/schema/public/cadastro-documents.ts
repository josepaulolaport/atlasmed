import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  cadastroDocumentStatusEnum,
  cadastroFileAssetStatusEnum,
  cadastroDocumentFileRoleEnum,
  cadastroUploadSessionStatusEnum,
  cadastroReviewDecisionEnum,
  cadastroProcessingStepStatusEnum,
} from "./enums";
import {
  facilities,
  conformityRequirements,
  facilityVerticalProfiles,
} from "./facilities";
import { users } from "./users";

/**
 * A cadastro document — the unit of the whole pipeline (ADR 0007).
 *
 * It belongs directly to a facility: uploaded, submitted, reviewed, approved
 * and versioned on its own. There is no package above it.
 *
 * `facilityVerticalProfileId` records which linha's requirement this satisfies.
 * NULL means facility-scoped — a Cartão CNPJ is uploaded once and counts for
 * every linha, mirroring `conformity_requirements.vertical_id`, where NULL
 * likewise means "applies to all".
 */
export const submissionDocuments = pgTable(
  "submission_documents",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    facilityVerticalProfileId: bigint("facility_vertical_profile_id", { mode: "number" })
      .references(() => facilityVerticalProfiles.id, { onDelete: "restrict" }),
    requirementId: bigint("requirement_id", { mode: "number" })
      .notNull().references(() => conformityRequirements.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    status: cadastroDocumentStatusEnum("status").notNull().default("DRAFT"),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    reviewComment: text("review_comment"),
    submittedByUserId: bigint("submitted_by_user_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("submission_documents_facility_id_idx").on(t.facilityId),
    index("submission_documents_facility_vertical_profile_id_idx").on(
      t.facilityVerticalProfileId
    ),
    index("submission_documents_requirement_id_idx").on(t.requirementId),
    index("submission_documents_status_idx").on(t.status),
    // Version is the history axis: one row per attempt at a requirement. The
    // package's "one DRAFT per facility" index is gone with the package that
    // owned it (D-16).
    uniqueIndex("submission_documents_facility_requirement_version_uidx").on(
      t.facilityId,
      t.requirementId,
      t.version
    ),
  ]
);

/** Immutable physical object in private storage. */
export const fileAssets = pgTable(
  "file_assets",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    storageProvider: text("storage_provider").notNull().default("s3"),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    thumbObjectKey: text("thumb_object_key"),
    previewObjectKey: text("preview_object_key"),
    originalFilename: text("original_filename").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    detectedMimeType: text("detected_mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    status: cadastroFileAssetStatusEnum("status").notNull().default("PENDING_UPLOAD"),
    pageCount: bigint("page_count", { mode: "number" }),
    width: bigint("width", { mode: "number" }),
    height: bigint("height", { mode: "number" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    uploadedAt: timestamp("uploaded_at"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("file_assets_facility_id_idx").on(t.facilityId),
    index("file_assets_status_idx").on(t.status),
    uniqueIndex("file_assets_object_key_uidx").on(t.objectKey),
  ]
);

/** Ordered association of a file asset to a logical document. */
export const documentFiles = pgTable(
  "document_files",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    submissionDocumentId: bigint("submission_document_id", { mode: "number" })
      .notNull().references(() => submissionDocuments.id, { onDelete: "cascade" }),
    fileAssetId: bigint("file_asset_id", { mode: "number" })
      .notNull().references(() => fileAssets.id, { onDelete: "restrict" }),
    position: bigint("position", { mode: "number" }).notNull().default(1),
    role: cadastroDocumentFileRoleEnum("role").notNull().default("PAGE"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("document_files_submission_document_id_idx").on(t.submissionDocumentId),
    index("document_files_file_asset_id_idx").on(t.fileAssetId),
    uniqueIndex("document_files_document_position_uidx").on(
      t.submissionDocumentId,
      t.position
    ),
    uniqueIndex("document_files_document_file_uidx").on(
      t.submissionDocumentId,
      t.fileAssetId
    ),
  ]
);

export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    fileAssetId: bigint("file_asset_id", { mode: "number" })
      .notNull().references(() => fileAssets.id, { onDelete: "cascade" }),
    storageUploadId: text("storage_upload_id").notNull(),
    status: cadastroUploadSessionStatusEnum("status").notNull().default("PENDING"),
    partSize: bigint("part_size", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("upload_sessions_file_asset_id_idx").on(t.fileAssetId),
    index("upload_sessions_status_idx").on(t.status),
    uniqueIndex("upload_sessions_storage_upload_id_uidx").on(t.storageUploadId),
  ]
);

export const uploadParts = pgTable(
  "upload_parts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    uploadSessionId: bigint("upload_session_id", { mode: "number" })
      .notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
    partNumber: bigint("part_number", { mode: "number" }).notNull(),
    etag: text("etag"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("upload_parts_upload_session_id_idx").on(t.uploadSessionId),
    uniqueIndex("upload_parts_session_part_uidx").on(
      t.uploadSessionId,
      t.partNumber
    ),
  ]
);

export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    submissionDocumentId: bigint("submission_document_id", { mode: "number" })
      .notNull().references(() => submissionDocuments.id, { onDelete: "cascade" }),
    reviewerId: bigint("reviewer_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "restrict" }),
    decision: cadastroReviewDecisionEnum("decision").notNull(),
    reasonCode: text("reason_code"),
    comment: text("comment"),
    documentVersion: bigint("document_version", { mode: "number" }).notNull(),
    flaggedFileAssetIds: bigint("flagged_file_asset_ids", { mode: "number" })
      .array()
      .notNull()
      .default(sql`'{}'::bigint[]`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("review_decisions_submission_document_id_idx").on(t.submissionDocumentId),
    index("review_decisions_reviewer_id_idx").on(t.reviewerId),
  ]
);

export const processingEvents = pgTable(
  "processing_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    fileAssetId: bigint("file_asset_id", { mode: "number" })
      .notNull().references(() => fileAssets.id, { onDelete: "cascade" }),
    processingStep: text("processing_step").notNull(),
    status: cadastroProcessingStepStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attempt: bigint("attempt", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("processing_events_file_asset_id_idx").on(t.fileAssetId),
    index("processing_events_processing_step_idx").on(t.processingStep),
  ]
);

export const submissionDocumentsRelations = relations(
  submissionDocuments,
  ({ one, many }) => ({
    facility: one(facilities, {
      fields: [submissionDocuments.facilityId],
      references: [facilities.id],
    }),
    verticalProfile: one(facilityVerticalProfiles, {
      fields: [submissionDocuments.facilityVerticalProfileId],
      references: [facilityVerticalProfiles.id],
    }),
    submittedBy: one(users, {
      fields: [submissionDocuments.submittedByUserId],
      references: [users.id],
    }),
    requirement: one(conformityRequirements, {
      fields: [submissionDocuments.requirementId],
      references: [conformityRequirements.id],
    }),
    files: many(documentFiles),
    decisions: many(reviewDecisions),
  })
);

export const fileAssetsRelations = relations(fileAssets, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [fileAssets.facilityId],
    references: [facilities.id],
  }),
  documentLinks: many(documentFiles),
  uploadSessions: many(uploadSessions),
  processingEvents: many(processingEvents),
}));

export const documentFilesRelations = relations(documentFiles, ({ one }) => ({
  document: one(submissionDocuments, {
    fields: [documentFiles.submissionDocumentId],
    references: [submissionDocuments.id],
  }),
  fileAsset: one(fileAssets, {
    fields: [documentFiles.fileAssetId],
    references: [fileAssets.id],
  }),
}));

export const uploadSessionsRelations = relations(uploadSessions, ({ one, many }) => ({
  fileAsset: one(fileAssets, {
    fields: [uploadSessions.fileAssetId],
    references: [fileAssets.id],
  }),
  parts: many(uploadParts),
}));

export const uploadPartsRelations = relations(uploadParts, ({ one }) => ({
  session: one(uploadSessions, {
    fields: [uploadParts.uploadSessionId],
    references: [uploadSessions.id],
  }),
}));
