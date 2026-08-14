-- Re-applies 0113 on any database that silently skipped it.
--
-- `0113_user_bookmarks` never ran in production, and `db:migrate` reported
-- "All migrations applied" while doing so. The cause is the journal, not the
-- migration:
--
--   112  0112_df_localities_resolve_to_brasilia   1786744335609
--   113  0113_user_bookmarks                      1786713799311   <- earlier
--
-- Drizzle's migrator reads `max(created_at)` from `__drizzle_migrations` **once,
-- at the start of a run**, and applies every journal entry whose `when` is
-- greater. Within a single run over a fresh database that is harmless — the
-- baseline is older than both, so both apply. Across two runs it is not: PR #289
-- deployed first and recorded 1786744335609, so PR #286's 0113, stamped half a
-- day earlier, was already "in the past" and was skipped for ever.
--
-- 0112's timestamp is the mistake. #289's migrations were renumbered during a
-- merge and stamped `max(when) + n` against main at that moment, which put them
-- ahead of a branch that had already been cut. Any PR branched before that and
-- merged after it would have been skipped the same way.
--
-- **Why a new migration rather than correcting 0113's `when`.** Bumping it fixes
-- production and breaks everywhere else: on a database where 0113 did apply — a
-- fresh environment, or any developer who ran the whole chain in one go — a
-- higher `when` makes it re-apply and fail on `relation already exists`. Tested,
-- not assumed. Forward-only and idempotent is the only shape that is correct in
-- both states.
--
-- So every statement here is guarded, and this migration is a no-op wherever
-- 0113 landed normally.

CREATE TABLE IF NOT EXISTS "user_facility_bookmarks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_facility_bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"facility_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_person_bookmarks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_person_bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

/*
 * Foreign keys. `ADD CONSTRAINT` has no IF NOT EXISTS, so each is checked
 * against `pg_constraint` by name — the same names 0113 uses, so a database
 * that already has them is left untouched.
 */
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_facility_bookmarks_user_id_users_id_fk') THEN
    ALTER TABLE "user_facility_bookmarks" ADD CONSTRAINT "user_facility_bookmarks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_facility_bookmarks_facility_id_facilities_id_fk') THEN
    ALTER TABLE "user_facility_bookmarks" ADD CONSTRAINT "user_facility_bookmarks_facility_id_facilities_id_fk"
      FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_person_bookmarks_user_id_users_id_fk') THEN
    ALTER TABLE "user_person_bookmarks" ADD CONSTRAINT "user_person_bookmarks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_person_bookmarks_person_id_persons_id_fk') THEN
    ALTER TABLE "user_person_bookmarks" ADD CONSTRAINT "user_person_bookmarks_person_id_persons_id_fk"
      FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_facility_bookmarks_user_id_facility_id_uidx" ON "user_facility_bookmarks" USING btree ("user_id","facility_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_facility_bookmarks_user_id_created_at_idx" ON "user_facility_bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_facility_bookmarks_facility_id_idx" ON "user_facility_bookmarks" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_person_bookmarks_user_id_person_id_uidx" ON "user_person_bookmarks" USING btree ("user_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_person_bookmarks_user_id_created_at_idx" ON "user_person_bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_person_bookmarks_person_id_idx" ON "user_person_bookmarks" USING btree ("person_id");--> statement-breakpoint

DO $$
DECLARE
  facility_n integer;
  person_n   integer;
BEGIN
  SELECT count(*) INTO facility_n FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'user_facility_bookmarks';
  SELECT count(*) INTO person_n FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'user_person_bookmarks';

  IF facility_n = 0 OR person_n = 0 THEN
    RAISE EXCEPTION 'bookmark tables still missing after 0114 — investigate before deploying';
  END IF;

  RAISE NOTICE 'Bookmark tables present.';
END $$;
