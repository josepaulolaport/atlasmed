import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  cadastroSubmissionStatusEnum,
  cadastroDocumentStatusEnum,
  cadastroFileAssetStatusEnum,
  cadastroDocumentFileRoleEnum,
  cadastroUploadSessionStatusEnum,
  cadastroReviewDecisionEnum,
  cadastroProcessingStepStatusEnum,
} from "./enums";
import { facilities, conformityRequirements } from "./facilities";
import { businessVerticals } from "./business-verticals";
import { users } from "./users";

/**
 * Versioned cadastro package for a facility.
 * Corrections open a new version; previous is SUPERSEDED.
 */
export const cadastroSubmissions = pgTable(
  "cadastro_submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id").references(() => businessVerticals.id, {
      onDelete: "restrict",
    }),
    submittedByUserId: text("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: cadastroSubmissionStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("cadastro_submissions_facility_id_idx").on(t.facilityId),
    index("cadastro_submissions_vertical_id_idx").on(t.verticalId),
    index("cadastro_submissions_status_idx").on(t.status),
    uniqueIndex("cadastro_submissions_facility_id_version_uidx").on(
      t.facilityId,
      t.version
    ),
    uniqueIndex("cadastro_submissions_facility_draft_uidx")
      .on(t.facilityId)
      .where(sql`${t.status} = 'DRAFT'`),
  ]
);

/** Logical document (e.g. Medical License) inside a submission. */
export const submissionDocuments = pgTable(
  "submission_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => cadastroSubmissions.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => conformityRequirements.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    status: cadastroDocumentStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("submission_documents_submission_id_idx").on(t.submissionId),
    index("submission_documents_requirement_id_idx").on(t.requirementId),
    index("submission_documents_status_idx").on(t.status),
    uniqueIndex("submission_documents_submission_requirement_uidx").on(
      t.submissionId,
      t.requirementId
    ),
  ]
);

/** Immutable physical object in private storage. */
export const fileAssets = pgTable(
  "file_assets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
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
    pageCount: integer("page_count"),
    width: integer("width"),
    height: integer("height"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    uploadedAt: timestamp("uploaded_at"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    submissionDocumentId: text("submission_document_id")
      .notNull()
      .references(() => submissionDocuments.id, { onDelete: "cascade" }),
    fileAssetId: text("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(1),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    fileAssetId: text("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "cascade" }),
    storageUploadId: text("storage_upload_id").notNull(),
    status: cadastroUploadSessionStatusEnum("status").notNull().default("PENDING"),
    partSize: integer("part_size").notNull(),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    uploadSessionId: text("upload_session_id")
      .notNull()
      .references(() => uploadSessions.id, { onDelete: "cascade" }),
    partNumber: integer("part_number").notNull(),
    etag: text("etag"),
    sizeBytes: integer("size_bytes"),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    submissionDocumentId: text("submission_document_id")
      .notNull()
      .references(() => submissionDocuments.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decision: cadastroReviewDecisionEnum("decision").notNull(),
    reasonCode: text("reason_code"),
    comment: text("comment"),
    documentVersion: integer("document_version").notNull(),
    flaggedFileAssetIds: text("flagged_file_asset_ids").array().notNull().default([]),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    fileAssetId: text("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "cascade" }),
    processingStep: text("processing_step").notNull(),
    status: cadastroProcessingStepStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("processing_events_file_asset_id_idx").on(t.fileAssetId),
    index("processing_events_processing_step_idx").on(t.processingStep),
  ]
);

export const cadastroSubmissionsRelations = relations(
  cadastroSubmissions,
  ({ one, many }) => ({
    facility: one(facilities, {
      fields: [cadastroSubmissions.facilityId],
      references: [facilities.id],
    }),
    vertical: one(businessVerticals, {
      fields: [cadastroSubmissions.verticalId],
      references: [businessVerticals.id],
    }),
    submittedBy: one(users, {
      fields: [cadastroSubmissions.submittedByUserId],
      references: [users.id],
    }),
    documents: many(submissionDocuments),
  })
);

export const submissionDocumentsRelations = relations(
  submissionDocuments,
  ({ one, many }) => ({
    submission: one(cadastroSubmissions, {
      fields: [submissionDocuments.submissionId],
      references: [cadastroSubmissions.id],
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
