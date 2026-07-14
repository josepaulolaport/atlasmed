-- facility_tax_id_type enum + taxIdType column on facilities + facility_services table

CREATE TYPE "public"."facility_tax_id_type" AS ENUM('PJ', 'PF');--> statement-breakpoint

ALTER TABLE "facilities" ADD COLUMN "tax_id_type" "facility_tax_id_type";--> statement-breakpoint

-- Backfill from existing tax identifier columns
UPDATE "facilities" SET "tax_id_type" = 'PJ' WHERE "cnpj" IS NOT NULL AND "cpf" IS NULL;--> statement-breakpoint
UPDATE "facilities" SET "tax_id_type" = 'PF' WHERE "cpf" IS NOT NULL AND "cnpj" IS NULL;--> statement-breakpoint

CREATE TABLE "facility_services" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"service_code" text NOT NULL,
	"classification_code" text,
	"source_provider" text DEFAULT 'cnes' NOT NULL,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "facility_services_facility_id_service_code_classification_code_uidx" ON "facility_services" USING btree ("facility_id","service_code","classification_code");--> statement-breakpoint
CREATE INDEX "facility_services_facility_id_idx" ON "facility_services" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_services_service_code_idx" ON "facility_services" USING btree ("service_code");
