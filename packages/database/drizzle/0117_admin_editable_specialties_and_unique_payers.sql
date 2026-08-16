ALTER TABLE "healthcare_specialties" ALTER COLUMN "cnes_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "healthcare_providers_name_normalized_uidx" ON "healthcare_providers" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "healthcare_specialties_name_normalized_uidx" ON "healthcare_specialties" USING btree (lower(trim("name")));