CREATE TYPE "ops"."emultec_skip_blocker" AS ENUM('DOCUMENT', 'SELLER', 'PRODUCTS', 'NONE');--> statement-breakpoint
CREATE TABLE "ops"."emultec_order_import_pending" (
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
CREATE INDEX "emultec_order_import_pending_open_blocker_idx" ON "ops"."emultec_order_import_pending" USING btree ("blocker") WHERE "ops"."emultec_order_import_pending"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "emultec_order_import_pending_vendedor_idx" ON "ops"."emultec_order_import_pending" USING btree ("id_vendedor_emultec") WHERE "ops"."emultec_order_import_pending"."resolved_at" IS NULL AND "ops"."emultec_order_import_pending"."id_vendedor_emultec" IS NOT NULL;