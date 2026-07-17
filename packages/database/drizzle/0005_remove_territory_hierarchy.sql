ALTER TABLE "territory_closure" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "territory_closure" CASCADE;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."territory_approval_type";--> statement-breakpoint
CREATE TYPE "public"."territory_approval_type" AS ENUM('deactivate_territory', 'clinic_territory_change');--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "type" SET DATA TYPE "public"."territory_approval_type" USING "type"::"public"."territory_approval_type";--> statement-breakpoint
DROP INDEX "territories_parent_id_idx";--> statement-breakpoint
DROP INDEX "territories_node_type_idx";--> statement-breakpoint
DROP INDEX "territories_country_code_idx";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "node_type";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "country_code";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "region_slug";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "state_code";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "centroid";--> statement-breakpoint
ALTER TABLE "territory_types" DROP COLUMN "is_country_level";--> statement-breakpoint
ALTER TABLE "territory_types" DROP COLUMN "participates_in_grouping_hierarchy";--> statement-breakpoint
DROP TYPE "public"."territory_node_type";