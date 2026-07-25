-- Drop fact→lookup FKs if present (from an earlier draft of 0022 on some envs).
-- Production never got these constraints (0022 failed before recording); use IF EXISTS.
-- Also drop Postgres-truncated names (63-char limit) where they differ.
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_facility_type_code_facility_types_facility_type_code_fk";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_facility_type_code_facility_types_facility_type_code";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_registry_deactivation_code_deactivation_reasons_deactivation_code_fk";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_registry_deactivation_code_deactivation_reasons_deac";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_unit_type_code_unit_types_unit_type_code_fk";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_unit_type_code_unit_subtype_code_fk";
--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT IF EXISTS "facility_professionals_source_occupation_code_occupations_occupation_code_fk";
--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT IF EXISTS "facility_professionals_source_occupation_code_occupations_occup";
--> statement-breakpoint
ALTER TABLE "facility_services" DROP CONSTRAINT IF EXISTS "facility_services_service_code_services_service_code_fk";
--> statement-breakpoint
ALTER TABLE "facility_services" DROP CONSTRAINT IF EXISTS "facility_services_service_code_classification_code_fk";
--> statement-breakpoint
ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "professionals_primary_occupation_code_occupations_occupation_code_fk";
--> statement-breakpoint
ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "professionals_primary_occupation_code_occupations_occupation_co";
