CREATE TABLE "deactivation_reasons" (
	"deactivation_code" text PRIMARY KEY NOT NULL,
	"deactivation_reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_types" (
	"facility_type_code" text PRIMARY KEY NOT NULL,
	"facility_type_name" text NOT NULL,
	"concept_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"occupation_code" text PRIMARY KEY NOT NULL,
	"occupation_name" text NOT NULL,
	"professional_classification" text,
	"is_health_occupation" text,
	"is_regulated" text,
	"reference_year" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_classifications" (
	"service_code" text NOT NULL,
	"classification_code" text NOT NULL,
	"classification_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_classifications_pkey" PRIMARY KEY("service_code","classification_code")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"service_code" text PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_subtypes" (
	"unit_type_code" text NOT NULL,
	"subtype_code" text NOT NULL,
	"subtype_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unit_subtypes_pkey" PRIMARY KEY("unit_type_code","subtype_code")
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"unit_type_code" text PRIMARY KEY NOT NULL,
	"unit_type_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "cnes_unit_id" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "unit_type_code" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "unit_subtype_code" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "languages" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "primary_occupation_code" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "cnes_professional_id" text;--> statement-breakpoint
ALTER TABLE "service_classifications" ADD CONSTRAINT "service_classifications_service_code_services_service_code_fk" FOREIGN KEY ("service_code") REFERENCES "public"."services"("service_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_subtypes" ADD CONSTRAINT "unit_subtypes_unit_type_code_unit_types_unit_type_code_fk" FOREIGN KEY ("unit_type_code") REFERENCES "public"."unit_types"("unit_type_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_facility_type_code_facility_types_facility_type_code_fk" FOREIGN KEY ("facility_type_code") REFERENCES "public"."facility_types"("facility_type_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_registry_deactivation_code_deactivation_reasons_deactivation_code_fk" FOREIGN KEY ("registry_deactivation_code") REFERENCES "public"."deactivation_reasons"("deactivation_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_unit_type_code_unit_types_unit_type_code_fk" FOREIGN KEY ("unit_type_code") REFERENCES "public"."unit_types"("unit_type_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_unit_type_code_unit_subtype_code_fk" FOREIGN KEY ("unit_type_code","unit_subtype_code") REFERENCES "public"."unit_subtypes"("unit_type_code","subtype_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_source_occupation_code_occupations_occupation_code_fk" FOREIGN KEY ("source_occupation_code") REFERENCES "public"."occupations"("occupation_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_service_code_services_service_code_fk" FOREIGN KEY ("service_code") REFERENCES "public"."services"("service_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_service_code_classification_code_fk" FOREIGN KEY ("service_code","classification_code") REFERENCES "public"."service_classifications"("service_code","classification_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_primary_occupation_code_occupations_occupation_code_fk" FOREIGN KEY ("primary_occupation_code") REFERENCES "public"."occupations"("occupation_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facilities_cnes_unit_id_idx" ON "facilities" USING btree ("cnes_unit_id") WHERE "facilities"."cnes_unit_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "facilities_facility_type_code_idx" ON "facilities" USING btree ("facility_type_code") WHERE "facilities"."facility_type_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "facilities_unit_type_code_idx" ON "facilities" USING btree ("unit_type_code") WHERE "facilities"."unit_type_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "facility_professionals_source_occupation_code_idx" ON "facility_professionals" USING btree ("source_occupation_code") WHERE "facility_professionals"."source_occupation_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_source_provider_cnes_professional_id_uidx" ON "professionals" USING btree ("source_provider","cnes_professional_id") WHERE "professionals"."cnes_professional_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "professionals_primary_occupation_code_idx" ON "professionals" USING btree ("primary_occupation_code") WHERE "professionals"."primary_occupation_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "professionals_cnes_professional_id_idx" ON "professionals" USING btree ("cnes_professional_id") WHERE "professionals"."cnes_professional_id" IS NOT NULL;