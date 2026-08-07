ALTER TABLE "facility_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unit_subtypes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unit_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "facility_types" CASCADE;--> statement-breakpoint
DROP TABLE "unit_subtypes" CASCADE;--> statement-breakpoint
DROP TABLE "unit_types" CASCADE;--> statement-breakpoint
DROP INDEX "facilities_facility_type_code_idx";--> statement-breakpoint
DROP INDEX "facilities_unit_type_code_idx";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "facility_type_code";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "unit_type_code";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "unit_subtype_code";