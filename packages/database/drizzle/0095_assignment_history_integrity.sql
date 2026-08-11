-- Spec 0009 I5: rep assignment rows are never deleted, so the two FKs that
-- could delete them stop being ON DELETE CASCADE.
--
-- The first DROP is hand-corrected. Drizzle emitted the 95-character derived
-- name; Postgres stored it truncated at 63, so dropping the full name would have
-- failed with "constraint does not exist" and aborted the migration. Both are
-- recreated with short explicit names so this cannot recur.

ALTER TABLE "facility_vertical_rep_assignments" DROP CONSTRAINT "facility_vertical_rep_assignments_facility_vertical_profile_id_";
--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" DROP CONSTRAINT "facility_vertical_rep_assignments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "fvra_profile_id_fk" FOREIGN KEY ("facility_vertical_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "fvra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_rep_assignments" ADD CONSTRAINT "fvra_override_reason_and_author_together_check" CHECK (("facility_vertical_rep_assignments"."override_reason" IS NULL) = ("facility_vertical_rep_assignments"."override_by_user_id" IS NULL));