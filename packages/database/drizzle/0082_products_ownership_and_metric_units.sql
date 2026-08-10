CREATE TYPE "public"."product_ownership" AS ENUM('OWN', 'COMPETITOR');--> statement-breakpoint
DROP INDEX "products_simpro_code_unique";--> statement-breakpoint
DROP INDEX "products_brasindice_code_unique";--> statement-breakpoint
DROP INDEX "products_tiss_code_unique";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "simpro_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "brasindice_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "tiss_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "brasindice_updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ownership" "product_ownership" DEFAULT 'OWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "metric_units" numeric(12, 3) DEFAULT '1' NOT NULL;--> statement-breakpoint
CREATE INDEX "products_ownership_idx" ON "products" USING btree ("ownership");--> statement-breakpoint
CREATE UNIQUE INDEX "products_simpro_code_unique" ON "products" USING btree ("simpro_code") WHERE "products"."simpro_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_brasindice_code_unique" ON "products" USING btree ("brasindice_code") WHERE "products"."brasindice_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_tiss_code_unique" ON "products" USING btree ("tiss_code") WHERE "products"."tiss_code" IS NOT NULL;--> statement-breakpoint
-- Clear the synthetic codes the NOT NULL constraint forced the Emultec importer
-- to invent (spec 0013 §2).
--
-- All 12 production products carry `EMULTEC-SIM-{id}`, `EMULTEC-BRA-{id}` and
-- `EMULTEC-TIS-{id}` — placeholder strings that satisfied the constraint and
-- meant nothing. Leaving them would make the real Brasíndice import (item 16)
-- reconcile against invented data, and would let a partial-unique index treat
-- fabricated values as real ones.
--
-- `brasindice_updated_at` goes with them: it was set to '1970-01-01' for the
-- same reason, and a revision date without a code it belongs to is noise.
--
-- Scoped to the EMULTEC- prefix so a genuine code entered by hand survives.
UPDATE "products"
SET
  "simpro_code" = CASE WHEN "simpro_code" LIKE 'EMULTEC-%' THEN NULL ELSE "simpro_code" END,
  "brasindice_code" = CASE WHEN "brasindice_code" LIKE 'EMULTEC-%' THEN NULL ELSE "brasindice_code" END,
  "tiss_code" = CASE WHEN "tiss_code" LIKE 'EMULTEC-%' THEN NULL ELSE "tiss_code" END,
  "brasindice_updated_at" = CASE
    WHEN "brasindice_code" LIKE 'EMULTEC-%' OR "brasindice_updated_at" = DATE '1970-01-01'
      THEN NULL
    ELSE "brasindice_updated_at"
  END
WHERE
  "simpro_code" LIKE 'EMULTEC-%'
  OR "brasindice_code" LIKE 'EMULTEC-%'
  OR "tiss_code" LIKE 'EMULTEC-%'
  OR "brasindice_updated_at" = DATE '1970-01-01';
