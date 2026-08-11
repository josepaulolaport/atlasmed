-- Spec 0011 §3.4 and §6, ADR 0008 §5 — who uploaded a file, and when its bytes
-- may be deleted.
--
-- `uploaded_by_user_id`: the draft belongs to the profile, not to a person, so
-- the assigned rep, their manager and OPS can all contribute to one document and
-- nobody could tell which of them sent a given file. Nullable and ON DELETE SET
-- NULL: the evidence outlives the account, and losing the attribution is
-- acceptable where losing the file is not.
--
-- `purge_after`: null means never. Set when a document is rejected, cleared when
-- it is approved. The sweep deletes the object and this row; the
-- `submission_documents` row survives with its status, version and reviewer
-- comment, so a purged attempt still renders as "v2 — Reprovado — <comment>".
--
-- Safe against a live table: both columns are nullable, so neither needs a
-- backfill and neither rewrites the table. The foreign key and the index are
-- validated against `file_assets`, which is empty in production (verified
-- against the 2026-08-10 snapshot), so both are instant. On a populated table
-- CREATE INDEX would block writes for its duration — worth knowing if this is
-- ever replayed somewhere with data.
--
-- Numbered 0093, not 0092: another lane landed 0092 while this was in flight, so
-- this was regenerated on top of main rather than renumbered by hand, which is
-- what keeps the snapshot's prevId chained to the migration that really precedes
-- it.

ALTER TABLE "file_assets" ADD COLUMN "uploaded_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "purge_after" timestamp;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_assets_purge_after_idx" ON "file_assets" USING btree ("purge_after") WHERE "file_assets"."purge_after" IS NOT NULL;