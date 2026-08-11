-- ADR 0007 — the cadastro document is the unit, not the package.
--
-- Drops `cadastro_submissions` and re-parents `submission_documents` onto the
-- facility, with a nullable `facility_vertical_profile_id` (NULL = facility
-- scoped: uploaded once, counts for every linha).
--
-- This migration is STRUCTURAL ONLY. It cannot move data, and it does not try:
-- `facility_id` is added NOT NULL with no backfill, and the only reason that is
-- safe is that the table is empty. Verified 0 rows in every cadastro table
-- against the 2026-08-10T10:47Z production dump. The guard below refuses to run
-- if that has changed since — a NOT NULL add against real rows would fail
-- mid-migration anyway, but failing here says why.

DO $$
DECLARE
  package_count bigint;
  document_count bigint;
BEGIN
  SELECT count(*) INTO package_count FROM cadastro_submissions;
  SELECT count(*) INTO document_count FROM submission_documents;

  IF package_count > 0 OR document_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to run 0084: cadastro data exists (% packages, % documents). '
      'This migration assumes empty tables and drops the package without '
      'migrating its rows. Write a data migration first: every document needs '
      'facility_id from its package, and facility_vertical_profile_id resolved '
      'from the package vertical_id.',
      package_count, document_count;
  END IF;
END $$;--> statement-breakpoint

-- ── Drop the package ────────────────────────────────────────────────────────
ALTER TABLE "cadastro_submissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cadastro_submissions" CASCADE;--> statement-breakpoint
-- CASCADE above already removed this FK; IF EXISTS keeps the statement honest
-- either way (the lesson from 0083, where the name was also truncated at 63).
ALTER TABLE "submission_documents" DROP CONSTRAINT IF EXISTS "submission_documents_submission_id_cadastro_submissions_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "submission_documents_submission_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "submission_documents_submission_requirement_uidx";--> statement-breakpoint
ALTER TABLE "submission_documents" DROP COLUMN "submission_id";--> statement-breakpoint
DROP TYPE "public"."cadastro_submission_status";--> statement-breakpoint

-- ── Re-parent the document ──────────────────────────────────────────────────
ALTER TABLE "submission_documents" ADD COLUMN "facility_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD COLUMN "facility_vertical_profile_id" bigint;--> statement-breakpoint
-- Submitter and timestamp move down from the package onto the document, which
-- is what "submitted" now means.
ALTER TABLE "submission_documents" ADD COLUMN "submitted_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Postgres truncates this name to 63 chars ("…_facility_vertical_profile_id_f").
-- Any later DROP CONSTRAINT must use the truncated name, not this one.
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_facility_vertical_profile_id_facility_vertical_profiles_id_fk" FOREIGN KEY ("facility_vertical_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_documents_facility_id_idx" ON "submission_documents" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "submission_documents_facility_vertical_profile_id_idx" ON "submission_documents" USING btree ("facility_vertical_profile_id");--> statement-breakpoint
-- One row per attempt at a requirement. Replaces the package's
-- "one DRAFT per facility" partial index, which is what wedged clinics (D-16).
CREATE UNIQUE INDEX "submission_documents_facility_requirement_version_uidx" ON "submission_documents" USING btree ("facility_id","requirement_id","version");
