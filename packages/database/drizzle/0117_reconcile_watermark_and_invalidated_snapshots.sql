CREATE TABLE "ops"."reconcile_watermark" (
	"name" text PRIMARY KEY NOT NULL,
	"covered_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_invalidated_snapshot_idx" ON "facility_vertical_profiles" USING btree ("facility_id") WHERE "facility_vertical_profiles"."is_active" = true and "facility_vertical_profiles"."purchase_recurrence_calculated_at" is null;