ALTER TABLE "user_territory_assignments" DROP CONSTRAINT "user_territory_assignments_assigned_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "territories_vertical_id_code_uidx";--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD COLUMN "ended_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD COLUMN "override_reason" text;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD COLUMN "override_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "fvra_ended_by_user_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "fvra_override_by_user_id_fk" FOREIGN KEY ("override_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_vertical_rep_assignments_override_idx" ON "facility_vertical_rep_assignments" USING btree ("override_by_user_id") WHERE "facility_vertical_rep_assignments"."override_reason" IS NOT NULL AND "facility_vertical_rep_assignments"."ended_at" IS NULL;--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "user_territory_assignments" DROP COLUMN "assigned_by";