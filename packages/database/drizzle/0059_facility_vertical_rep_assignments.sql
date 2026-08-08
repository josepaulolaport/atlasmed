CREATE TABLE "facility_vertical_rep_assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "facility_vertical_rep_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"facility_vertical_profile_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"assigned_by_user_id" bigint,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facility_vertical_rep_assignments_ended_at_gte_started_at_check" CHECK ("facility_vertical_rep_assignments"."ended_at" IS NULL OR "facility_vertical_rep_assignments"."ended_at" >= "facility_vertical_rep_assignments"."started_at")
);
--> statement-breakpoint
DROP TABLE "facility_consultant_assignments" CASCADE;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "facility_vertical_rep_assignments_facility_vertical_profile_id_facility_vertical_profiles_id_fk" FOREIGN KEY ("facility_vertical_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "facility_vertical_rep_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "facility_vertical_rep_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_vertical_rep_assignments_profile_id_ended_at_idx" ON "facility_vertical_rep_assignments" USING btree ("facility_vertical_profile_id","ended_at");--> statement-breakpoint
CREATE INDEX "facility_vertical_rep_assignments_user_id_ended_at_idx" ON "facility_vertical_rep_assignments" USING btree ("user_id","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_vertical_rep_assignments_profile_active_uidx" ON "facility_vertical_rep_assignments" USING btree ("facility_vertical_profile_id") WHERE "facility_vertical_rep_assignments"."ended_at" IS NULL;