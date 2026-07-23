CREATE TYPE "public"."cadastro_document_file_role" AS ENUM('FRONT', 'BACK', 'PAGE', 'ATTACHMENT', 'SUPPORTING_DOCUMENT');--> statement-breakpoint
CREATE TYPE "public"."cadastro_document_status" AS ENUM('DRAFT', 'PROCESSING', 'READY', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."cadastro_file_asset_status" AS ENUM('PENDING_UPLOAD', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."cadastro_processing_step_status" AS ENUM('STARTED', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."cadastro_review_decision" AS ENUM('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."cadastro_submission_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."cadastro_upload_session_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "cadastro_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"submitted_by_user_id" text,
	"status" "cadastro_submission_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_files" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_document_id" text NOT NULL,
	"file_asset_id" text NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"role" "cadastro_document_file_role" DEFAULT 'PAGE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"storage_provider" text DEFAULT 's3' NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"thumb_object_key" text,
	"preview_object_key" text,
	"original_filename" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"detected_mime_type" text,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"status" "cadastro_file_asset_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"page_count" integer,
	"width" integer,
	"height" integer,
	"error_code" text,
	"error_message" text,
	"uploaded_at" timestamp,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"file_asset_id" text NOT NULL,
	"processing_step" text NOT NULL,
	"status" "cadastro_processing_step_status" NOT NULL,
	"error_code" text,
	"error_message" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_document_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "cadastro_review_decision" NOT NULL,
	"reason_code" text,
	"comment" text,
	"document_version" integer NOT NULL,
	"flagged_file_asset_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "cadastro_document_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"review_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_parts" (
	"id" text PRIMARY KEY NOT NULL,
	"upload_session_id" text NOT NULL,
	"part_number" integer NOT NULL,
	"etag" text,
	"size_bytes" integer,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"file_asset_id" text NOT NULL,
	"storage_upload_id" text NOT NULL,
	"status" "cadastro_upload_session_status" DEFAULT 'PENDING' NOT NULL,
	"part_size" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "allowed_mime_types" text[] DEFAULT '{"image/jpeg","image/png","application/pdf"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "max_files" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "max_file_size_bytes" bigint DEFAULT 52428800 NOT NULL;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "max_combined_size_bytes" bigint DEFAULT 209715200 NOT NULL;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "requires_front_and_back" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_submission_document_id_submission_documents_id_fk" FOREIGN KEY ("submission_document_id") REFERENCES "public"."submission_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_events" ADD CONSTRAINT "processing_events_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_submission_document_id_submission_documents_id_fk" FOREIGN KEY ("submission_document_id") REFERENCES "public"."submission_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_submission_id_cadastro_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."cadastro_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_requirement_id_conformity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."conformity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_parts" ADD CONSTRAINT "upload_parts_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "public"."upload_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cadastro_submissions_facility_id_idx" ON "cadastro_submissions" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "cadastro_submissions_status_idx" ON "cadastro_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cadastro_submissions_facility_id_version_uidx" ON "cadastro_submissions" USING btree ("facility_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "cadastro_submissions_facility_draft_uidx" ON "cadastro_submissions" USING btree ("facility_id") WHERE "cadastro_submissions"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "document_files_submission_document_id_idx" ON "document_files" USING btree ("submission_document_id");--> statement-breakpoint
CREATE INDEX "document_files_file_asset_id_idx" ON "document_files" USING btree ("file_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_files_document_position_uidx" ON "document_files" USING btree ("submission_document_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "document_files_document_file_uidx" ON "document_files" USING btree ("submission_document_id","file_asset_id");--> statement-breakpoint
CREATE INDEX "file_assets_facility_id_idx" ON "file_assets" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "file_assets_status_idx" ON "file_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_object_key_uidx" ON "file_assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "processing_events_file_asset_id_idx" ON "processing_events" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "processing_events_processing_step_idx" ON "processing_events" USING btree ("processing_step");--> statement-breakpoint
CREATE INDEX "review_decisions_submission_document_id_idx" ON "review_decisions" USING btree ("submission_document_id");--> statement-breakpoint
CREATE INDEX "review_decisions_reviewer_id_idx" ON "review_decisions" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "submission_documents_submission_id_idx" ON "submission_documents" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_documents_requirement_id_idx" ON "submission_documents" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "submission_documents_status_idx" ON "submission_documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_documents_submission_requirement_uidx" ON "submission_documents" USING btree ("submission_id","requirement_id");--> statement-breakpoint
CREATE INDEX "upload_parts_upload_session_id_idx" ON "upload_parts" USING btree ("upload_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_parts_session_part_uidx" ON "upload_parts" USING btree ("upload_session_id","part_number");--> statement-breakpoint
CREATE INDEX "upload_sessions_file_asset_id_idx" ON "upload_sessions" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_storage_upload_id_uidx" ON "upload_sessions" USING btree ("storage_upload_id");