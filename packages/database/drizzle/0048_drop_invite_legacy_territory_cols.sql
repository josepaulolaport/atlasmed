ALTER TABLE "invitations" DROP CONSTRAINT "invitations_manager_territory_id_territories_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_rep_territory_id_territories_id_fk";
--> statement-breakpoint
DROP INDEX "invitations_manager_territory_id_idx";--> statement-breakpoint
DROP INDEX "invitations_rep_territory_id_idx";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "manager_territory_id";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "rep_territory_id";