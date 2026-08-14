-- Re-applies 0106 on any database that silently skipped it.
--
-- The same defect 0114 fixed for the bookmark tables, one migration pair
-- earlier, and this one predates the CNES work entirely:
--
--   105  0105_is_valid_cpf                  1786744335603
--   106  0106_emultec_order_import_pending  1786690702241   <- ~15h earlier
--
-- Drizzle's migrator reads `max(created_at)` once per run and applies every
-- journal entry whose `when` exceeds it. #277 merged at 06:09 and recorded
-- 1786744335603; #282 deployed an hour later carrying a `when` stamped the
-- previous evening, already in the past, and was skipped — while `db:migrate`
-- reported "All migrations applied".
--
-- The consequence is that `ops.emultec_order_import_pending` does not exist, so
-- the skip-recovery queue #282 introduced has been silently inert: orders the
-- importer refuses are supposed to be recorded here and re-checked once their
-- blocker clears, and instead every write to it fails.
--
-- Forward-only and guarded, for the same reason as 0114: correcting 0106's
-- `when` would fix the databases that skipped it and break every one that did
-- not, where the CREATE would hit `relation already exists`. This is a no-op
-- wherever 0106 landed normally.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'ops' AND t.typname = 'emultec_skip_blocker'
  ) THEN
    CREATE TYPE "ops"."emultec_skip_blocker" AS ENUM('DOCUMENT', 'SELLER', 'PRODUCTS', 'NONE');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ops"."emultec_order_import_pending" (
	"id_avulsa_emultec" bigint PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"blocker" "ops"."emultec_skip_blocker" NOT NULL,
	"id_cliente_emultec" bigint,
	"blocker_documents" text[],
	"id_vendedor_emultec" bigint,
	"blocker_product_ids" bigint[],
	"first_skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"skip_count" integer DEFAULT 1 NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "emultec_order_import_pending_open_blocker_idx" ON "ops"."emultec_order_import_pending" USING btree ("blocker") WHERE "ops"."emultec_order_import_pending"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emultec_order_import_pending_vendedor_idx" ON "ops"."emultec_order_import_pending" USING btree ("id_vendedor_emultec") WHERE "ops"."emultec_order_import_pending"."resolved_at" IS NULL AND "ops"."emultec_order_import_pending"."id_vendedor_emultec" IS NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF to_regclass('ops.emultec_order_import_pending') IS NULL THEN
    RAISE EXCEPTION 'ops.emultec_order_import_pending still missing after 0115 — investigate before deploying';
  END IF;
  RAISE NOTICE 'Emultec skip-recovery queue present.';
END $$;
