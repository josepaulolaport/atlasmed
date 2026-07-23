ALTER TABLE "conformity_records" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD COLUMN "reviewer_note" text;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "applies_to_tax_id_type" "facility_tax_id_type";--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "billing_email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "conformity_records_storage_key_uidx" ON "conformity_records" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "conformity_requirements_applies_to_tax_id_type_idx" ON "conformity_requirements" USING btree ("applies_to_tax_id_type");