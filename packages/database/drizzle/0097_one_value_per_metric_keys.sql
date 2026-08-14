ALTER TABLE "facility_product_usage" DROP CONSTRAINT "facility_product_usage_profile_definition_product_month_key";--> statement-breakpoint
ALTER TABLE "facility_metric_snapshots" DROP CONSTRAINT "facility_metric_snapshots_month_is_first_of_month";--> statement-breakpoint
ALTER TABLE "facility_product_usage" DROP CONSTRAINT "facility_product_usage_quantity_non_negative";--> statement-breakpoint
ALTER TABLE "facility_product_usage" DROP CONSTRAINT "facility_product_usage_month_is_first_of_month";--> statement-breakpoint
DROP INDEX "facility_metric_snapshots_month_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_uidx" ON "invitations" USING btree (lower("email")) WHERE "invitations"."status" = 'PENDING' AND "invitations"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_phone_number_uidx" ON "invitations" USING btree ("phone_number") WHERE "invitations"."status" = 'PENDING' AND "invitations"."phone_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_metric_snapshots" DROP CONSTRAINT "facility_metric_snapshots_pkey";
--> statement-breakpoint
ALTER TABLE "facility_metric_snapshots" ADD CONSTRAINT "facility_metric_snapshots_pkey" PRIMARY KEY("facility_vertical_profile_id","definition_id");--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_profile_definition_product_key" UNIQUE("facility_vertical_profile_id","definition_id","product_id");--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_quantity_positive" CHECK ("facility_product_usage"."quantity" > 0);