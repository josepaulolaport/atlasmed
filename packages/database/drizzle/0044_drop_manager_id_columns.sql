ALTER TABLE "user_vertical_assignments" DROP CONSTRAINT "user_vertical_assignments_manager_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_manager_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" DROP CONSTRAINT "invitation_vertical_assignments_manager_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP CONSTRAINT "facility_vertical_profiles_territory_id_territories_id_fk";
--> statement-breakpoint
DROP INDEX "user_vertical_assignments_manager_id_idx";--> statement-breakpoint
DROP INDEX "invitations_manager_id_idx";--> statement-breakpoint
DROP INDEX "users_manager_id_idx";--> statement-breakpoint
DROP INDEX "invitation_vertical_assignments_manager_id_idx";--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_manager_zone_id_territories_id_fk" FOREIGN KEY ("manager_zone_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" DROP COLUMN "manager_id";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "manager_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "manager_id";--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" DROP COLUMN "manager_id";