CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TABLE "ops"."emultec_order_import_dead_letters" (
	"id_avulsa_emultec" bigint PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"first_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops"."emultec_order_import_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ops"."emultec_order_import_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workflow_id" text,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"upserted" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"skip_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"watermark_before" bigint,
	"watermark_after" bigint,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE INDEX "emultec_order_import_dead_letters_open_idx" ON "ops"."emultec_order_import_dead_letters" USING btree ("last_failed_at") WHERE "ops"."emultec_order_import_dead_letters"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "emultec_order_import_runs_started_at_idx" ON "ops"."emultec_order_import_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "emultec_order_import_runs_status_idx" ON "ops"."emultec_order_import_runs" USING btree ("status");