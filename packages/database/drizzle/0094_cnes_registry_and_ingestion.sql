CREATE SCHEMA "registry";
--> statement-breakpoint
CREATE SCHEMA "ingestion";
--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_run_phase" AS ENUM('DISCOVERING', 'DOWNLOADING', 'EXTRACTING', 'PREFLIGHT', 'LOADING', 'VALIDATING', 'PROMOTING', 'BRIDGING');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "registry"."facilities" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"cnes_unit_code" text,
	"atlasmed_id" bigint,
	"legal_name" text,
	"trade_name" text,
	"tax_id_cnpj" text,
	"tax_id_cpf" text,
	"street_address" text,
	"street_number" text,
	"address_complement" text,
	"neighborhood" text,
	"postal_code" text,
	"municipality_cnes_id" text,
	"phone_number" text,
	"email" text,
	"unit_type_code" text,
	"unit_type_name" text,
	"unit_subtype_name" text,
	"deactivation_reason_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_professional_occupations" (
	"facility_cnes_id" text NOT NULL,
	"professional_cnes_id" text NOT NULL,
	"occupation_cnes_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_facility_professional_occupations_pkey" PRIMARY KEY("facility_cnes_id","professional_cnes_id","occupation_cnes_id")
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_professionals" (
	"facility_cnes_id" text NOT NULL,
	"professional_cnes_id" text NOT NULL,
	"cnes_unit_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_facility_professionals_pkey" PRIMARY KEY("facility_cnes_id","professional_cnes_id")
);
--> statement-breakpoint
CREATE TABLE "registry"."municipalities" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state_cnes_id" text NOT NULL,
	"atlasmed_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."occupations" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_health_occupation" boolean,
	"is_regulated" boolean,
	"atlasmed_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."professional_councils" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"atlasmed_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_professional_councils_abbreviation_key" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "registry"."professional_registrations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registry"."professional_registrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"professional_cnes_id" text NOT NULL,
	"council_cnes_id" text NOT NULL,
	"state_code" text NOT NULL,
	"registration_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_professional_registrations_council_state_number_key" UNIQUE("council_cnes_id","state_code","registration_number"),
	CONSTRAINT "registry_prof_registrations_prof_council_state_key" UNIQUE("professional_cnes_id","council_cnes_id","state_code"),
	CONSTRAINT "registry_professional_registrations_state_code_len_check" CHECK (char_length("registry"."professional_registrations"."state_code") = 2),
	CONSTRAINT "registry_professional_registrations_number_not_blank_check" CHECK (char_length(btrim("registry"."professional_registrations"."registration_number")) > 0)
);
--> statement-breakpoint
CREATE TABLE "registry"."professionals" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"atlasmed_id" bigint,
	"full_name" text NOT NULL,
	"social_name" text,
	"tax_id" text,
	"health_card_number" text,
	"source_first_seen_at" timestamp DEFAULT now() NOT NULL,
	"source_last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."states" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"atlasmed_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_states_cnes_id_len_check" CHECK (char_length("registry"."states"."cnes_id") = 2)
);
--> statement-breakpoint
CREATE TABLE "ingestion"."cnes_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingestion"."cnes_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"temporal_workflow_id" text,
	"reference_year" integer,
	"reference_month" integer,
	"status" "ingestion"."cnes_run_status" DEFAULT 'RUNNING' NOT NULL,
	"phase" "ingestion"."cnes_run_phase",
	"phase_started_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"promoted_at" timestamp with time zone,
	"stats" jsonb,
	"validation_report" jsonb,
	"archive_manifest" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD CONSTRAINT "registry_facilities_municipality_cnes_id_fk" FOREIGN KEY ("municipality_cnes_id") REFERENCES "registry"."municipalities"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."facility_professional_occupations" ADD CONSTRAINT "registry_facility_professional_occupations_vinculo_fk" FOREIGN KEY ("facility_cnes_id","professional_cnes_id") REFERENCES "registry"."facility_professionals"("facility_cnes_id","professional_cnes_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."facility_professional_occupations" ADD CONSTRAINT "registry_facility_prof_occupations_occupation_fk" FOREIGN KEY ("occupation_cnes_id") REFERENCES "registry"."occupations"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."facility_professionals" ADD CONSTRAINT "registry_facility_professionals_facility_cnes_id_fk" FOREIGN KEY ("facility_cnes_id") REFERENCES "registry"."facilities"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."facility_professionals" ADD CONSTRAINT "registry_facility_professionals_professional_cnes_id_fk" FOREIGN KEY ("professional_cnes_id") REFERENCES "registry"."professionals"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."municipalities" ADD CONSTRAINT "registry_municipalities_state_cnes_id_fk" FOREIGN KEY ("state_cnes_id") REFERENCES "registry"."states"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."professional_registrations" ADD CONSTRAINT "registry_professional_registrations_professional_cnes_id_fk" FOREIGN KEY ("professional_cnes_id") REFERENCES "registry"."professionals"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registry"."professional_registrations" ADD CONSTRAINT "registry_professional_registrations_council_cnes_id_fk" FOREIGN KEY ("council_cnes_id") REFERENCES "registry"."professional_councils"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_facilities_cnes_unit_code_uidx" ON "registry"."facilities" USING btree ("cnes_unit_code") WHERE "registry"."facilities"."cnes_unit_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_facilities_atlasmed_id_uidx" ON "registry"."facilities" USING btree ("atlasmed_id") WHERE "registry"."facilities"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_facilities_municipality_cnes_id_idx" ON "registry"."facilities" USING btree ("municipality_cnes_id");--> statement-breakpoint
CREATE INDEX "registry_facility_professional_occupations_occupation_idx" ON "registry"."facility_professional_occupations" USING btree ("occupation_cnes_id");--> statement-breakpoint
CREATE INDEX "registry_facility_professional_occupations_professional_idx" ON "registry"."facility_professional_occupations" USING btree ("professional_cnes_id");--> statement-breakpoint
CREATE INDEX "registry_facility_professionals_professional_cnes_id_idx" ON "registry"."facility_professionals" USING btree ("professional_cnes_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registry_municipalities_atlasmed_id_uidx" ON "registry"."municipalities" USING btree ("atlasmed_id") WHERE "registry"."municipalities"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_municipalities_state_cnes_id_idx" ON "registry"."municipalities" USING btree ("state_cnes_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registry_occupations_atlasmed_id_uidx" ON "registry"."occupations" USING btree ("atlasmed_id") WHERE "registry"."occupations"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_occupations_is_health_occupation_idx" ON "registry"."occupations" USING btree ("is_health_occupation") WHERE "registry"."occupations"."is_health_occupation";--> statement-breakpoint
CREATE UNIQUE INDEX "registry_professional_councils_atlasmed_id_uidx" ON "registry"."professional_councils" USING btree ("atlasmed_id") WHERE "registry"."professional_councils"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_professional_registrations_professional_cnes_id_idx" ON "registry"."professional_registrations" USING btree ("professional_cnes_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registry_professionals_atlasmed_id_uidx" ON "registry"."professionals" USING btree ("atlasmed_id") WHERE "registry"."professionals"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_professionals_tax_id_idx" ON "registry"."professionals" USING btree ("tax_id") WHERE "registry"."professionals"."tax_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registry_professionals_full_name_idx" ON "registry"."professionals" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "registry_states_atlasmed_id_uidx" ON "registry"."states" USING btree ("atlasmed_id") WHERE "registry"."states"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cnes_runs_active_reference_uidx" ON "ingestion"."cnes_runs" USING btree ("reference_year","reference_month") WHERE "ingestion"."cnes_runs"."status" = 'RUNNING';--> statement-breakpoint
CREATE UNIQUE INDEX "cnes_runs_temporal_workflow_id_uidx" ON "ingestion"."cnes_runs" USING btree ("temporal_workflow_id") WHERE "ingestion"."cnes_runs"."temporal_workflow_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cnes_runs_status_started_at_idx" ON "ingestion"."cnes_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "person_facility_occupations_primary_uidx" ON "person_facility_occupations" USING btree ("person_facility_id") WHERE "person_facility_occupations"."is_primary";