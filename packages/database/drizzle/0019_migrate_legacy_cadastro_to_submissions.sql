-- Migrate legacy conformity_records (1 file/row) into versioned submissions.
-- Identity docs require front+back going forward.

UPDATE "conformity_requirements"
SET "requires_front_and_back" = true,
    "updated_at" = now()
WHERE "slug" = 'identidade'
  AND "is_active" = true;

-- One submission per facility that has at least one filed record.
INSERT INTO "cadastro_submissions" (
  "id",
  "facility_id",
  "submitted_by_user_id",
  "status",
  "version",
  "submitted_at",
  "created_at",
  "updated_at"
)
SELECT
  'mig_sub_' || f."facility_id",
  f."facility_id",
  NULL,
  CASE
    WHEN bool_and(f."status" = 'VALIDATED') THEN 'APPROVED'::cadastro_submission_status
    WHEN bool_or(f."status" = 'REJECTED') AND bool_and(f."status" IN ('VALIDATED', 'REJECTED')) THEN 'REJECTED'::cadastro_submission_status
    WHEN bool_or(f."status" = 'SUBMITTED') THEN 'UNDER_REVIEW'::cadastro_submission_status
    ELSE 'DRAFT'::cadastro_submission_status
  END,
  1,
  max(f."submitted_at"),
  now(),
  now()
FROM (
  SELECT DISTINCT ON ("facility_id", "requirement_id")
    "facility_id",
    "requirement_id",
    "status",
    "submitted_at",
    "storage_key",
    "content_type",
    "file_name",
    "validated_by_user_id"
  FROM "conformity_records"
  WHERE "storage_key" IS NOT NULL
  ORDER BY "facility_id", "requirement_id", "updated_at" DESC
) f
GROUP BY f."facility_id"
ON CONFLICT DO NOTHING;

INSERT INTO "submission_documents" (
  "id",
  "submission_id",
  "requirement_id",
  "title",
  "status",
  "version",
  "review_comment",
  "created_at",
  "updated_at"
)
SELECT
  'mig_doc_' || cr."id",
  'mig_sub_' || cr."facility_id",
  cr."requirement_id",
  coalesce(req."name", 'Documento'),
  CASE cr."status"
    WHEN 'VALIDATED' THEN 'APPROVED'::cadastro_document_status
    WHEN 'REJECTED' THEN 'REJECTED'::cadastro_document_status
    WHEN 'SUBMITTED' THEN 'UNDER_REVIEW'::cadastro_document_status
    ELSE 'DRAFT'::cadastro_document_status
  END,
  1,
  cr."reviewer_note",
  now(),
  now()
FROM "conformity_records" cr
INNER JOIN "conformity_requirements" req ON req."id" = cr."requirement_id"
WHERE cr."storage_key" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "cadastro_submissions" s
    WHERE s."id" = 'mig_sub_' || cr."facility_id"
  )
ON CONFLICT DO NOTHING;

INSERT INTO "file_assets" (
  "id",
  "facility_id",
  "storage_provider",
  "bucket",
  "object_key",
  "original_filename",
  "declared_mime_type",
  "detected_mime_type",
  "size_bytes",
  "status",
  "uploaded_at",
  "processed_at",
  "created_at",
  "updated_at"
)
SELECT
  'mig_file_' || cr."id",
  cr."facility_id",
  's3',
  'atlasmed',
  cr."storage_key",
  coalesce(cr."file_name", 'document'),
  coalesce(cr."content_type", 'application/octet-stream'),
  cr."content_type",
  0,
  CASE cr."status"
    WHEN 'VALIDATED' THEN 'READY'::cadastro_file_asset_status
    WHEN 'SUBMITTED' THEN 'READY'::cadastro_file_asset_status
    WHEN 'REJECTED' THEN 'READY'::cadastro_file_asset_status
    ELSE 'UPLOADED'::cadastro_file_asset_status
  END,
  cr."submitted_at",
  cr."validated_at",
  now(),
  now()
FROM "conformity_records" cr
WHERE cr."storage_key" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "document_files" (
  "id",
  "submission_document_id",
  "file_asset_id",
  "position",
  "role",
  "created_at"
)
SELECT
  'mig_df_' || cr."id",
  'mig_doc_' || cr."id",
  'mig_file_' || cr."id",
  1,
  'PAGE'::cadastro_document_file_role,
  now()
FROM "conformity_records" cr
WHERE cr."storage_key" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "submission_documents" d
    WHERE d."id" = 'mig_doc_' || cr."id"
  )
  AND EXISTS (
    SELECT 1 FROM "file_assets" fa
    WHERE fa."id" = 'mig_file_' || cr."id"
  )
ON CONFLICT DO NOTHING;
