CREATE TYPE "public"."purchase_funnel_stage" AS ENUM('NEVER_PURCHASED', 'OUTSIDE_WINDOW', 'PURCHASE_WINDOW', 'CHURN', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."purchase_interval_source" AS ENUM('DEFAULT', 'CALCULATED', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."purchase_profile" AS ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "observed_purchase_interval_days" integer;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "purchase_interval_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "purchase_interval_source" "purchase_interval_source" DEFAULT 'DEFAULT' NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "manual_purchase_profile" "purchase_profile";--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "manual_purchase_interval_days" integer;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "last_valid_purchase_date" date;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "purchase_recurrence_sample_size" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "purchase_funnel_stage" "purchase_funnel_stage" DEFAULT 'NEVER_PURCHASED' NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "next_purchase_funnel_transition_date" date;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "purchase_recurrence_calculated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "facilities_active_purchase_funnel_stage_name_id_idx" ON "facilities" USING btree ("purchase_funnel_stage","name","id") WHERE "facilities"."deactivated_at" is null;--> statement-breakpoint
CREATE INDEX "facilities_active_purchase_interval_days_name_id_idx" ON "facilities" USING btree ("purchase_interval_days","name","id") WHERE "facilities"."deactivated_at" is null;--> statement-breakpoint
CREATE INDEX "facilities_active_manual_purchase_profile_name_id_idx" ON "facilities" USING btree ("manual_purchase_profile","name","id") WHERE "facilities"."deactivated_at" is null;--> statement-breakpoint
CREATE INDEX "facilities_active_next_purchase_funnel_transition_date_idx" ON "facilities" USING btree ("next_purchase_funnel_transition_date","id") WHERE "facilities"."deactivated_at" is null and "facilities"."next_purchase_funnel_transition_date" is not null;--> statement-breakpoint
CREATE INDEX "orders_valid_purchase_facility_ordered_at_idx" ON "orders" USING btree ("facility_id","ordered_at" DESC NULLS LAST) WHERE "orders"."status" in ('APPROVED', 'INVOICED') and "orders"."type" in ('SALE', 'CONSIGNMENT');--> statement-breakpoint
CREATE INDEX "orders_updated_at_facility_id_idx" ON "orders" USING btree ("updated_at","facility_id");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_observed_purchase_interval_days_check" CHECK ("facilities"."observed_purchase_interval_days" is null or "facilities"."observed_purchase_interval_days" between 1 and 3650);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_purchase_interval_days_check" CHECK ("facilities"."purchase_interval_days" between 1 and 3650);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_manual_purchase_interval_days_check" CHECK ("facilities"."manual_purchase_interval_days" is null or "facilities"."manual_purchase_interval_days" between 1 and 3650);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_manual_purchase_profile_days_check" CHECK (("facilities"."manual_purchase_profile" = 'CUSTOM' and "facilities"."manual_purchase_interval_days" is not null)
        or ("facilities"."manual_purchase_profile" is distinct from 'CUSTOM' and "facilities"."manual_purchase_interval_days" is null));--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_purchase_recurrence_sample_size_check" CHECK ("facilities"."purchase_recurrence_sample_size" between 0 and 12);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_purchase_interval_source_check" CHECK (("facilities"."purchase_interval_source" = 'MANUAL' and "facilities"."manual_purchase_profile" is not null)
        or ("facilities"."purchase_interval_source" <> 'MANUAL' and "facilities"."manual_purchase_profile" is null));