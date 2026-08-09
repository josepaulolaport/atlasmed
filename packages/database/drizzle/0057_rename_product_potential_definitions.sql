-- Rename potential_metric_definitions → product_potential_definitions (user lock).
ALTER TABLE "potential_metric_definitions" RENAME TO "product_potential_definitions";
--> statement-breakpoint
ALTER SEQUENCE "potential_metric_definitions_id_seq" RENAME TO "product_potential_definitions_id_seq";
--> statement-breakpoint
ALTER INDEX "potential_metric_definitions_vertical_id_idx" RENAME TO "product_potential_definitions_vertical_id_idx";
--> statement-breakpoint
ALTER INDEX "potential_metric_definitions_vertical_key_active_uidx" RENAME TO "product_potential_definitions_vertical_key_active_uidx";
--> statement-breakpoint
ALTER TABLE "product_potential_definitions" RENAME CONSTRAINT "potential_metric_definitions_vertical_id_business_verticals_id_fk" TO "product_potential_definitions_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER TABLE "facility_potential_values" RENAME CONSTRAINT "facility_potential_values_definition_id_potential_metric_definitions_id_fk" TO "facility_potential_values_definition_id_product_potential_definitions_id_fk";
--> statement-breakpoint
ALTER TABLE "product_potential_links" RENAME CONSTRAINT "product_potential_links_definition_id_potential_metric_definitions_id_fk" TO "product_potential_links_definition_id_product_potential_definitions_id_fk";
