-- Phase 1 schema decisions: sector hooks, user FKs, relationship level 1-10, drop organization_id

ALTER TABLE "territories" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN "sector_id" text;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "territories_sector_id_idx" ON "territories" USING btree ("sector_id");--> statement-breakpoint

CREATE TABLE "user_sector_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sector_id" text NOT NULL,
	"assigned_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_sector_assignments" ADD CONSTRAINT "user_sector_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sector_assignments" ADD CONSTRAINT "user_sector_assignments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sector_assignments" ADD CONSTRAINT "user_sector_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_sector_assignments_user_id_sector_id_uidx" ON "user_sector_assignments" USING btree ("user_id","sector_id");--> statement-breakpoint
CREATE INDEX "user_sector_assignments_user_id_idx" ON "user_sector_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sector_assignments_sector_id_idx" ON "user_sector_assignments" USING btree ("sector_id");--> statement-breakpoint

ALTER TABLE "facility_professionals" ADD COLUMN "relationship_level_int" smallint;--> statement-breakpoint
UPDATE "facility_professionals" SET "relationship_level_int" = CASE
  WHEN "relationship_level"::text = 'LOW' THEN 3
  WHEN "relationship_level"::text = 'MEDIUM' THEN 5
  WHEN "relationship_level"::text = 'HIGH' THEN 8
  ELSE NULL
END;--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP COLUMN "relationship_level";--> statement-breakpoint
ALTER TABLE "facility_professionals" RENAME COLUMN "relationship_level_int" TO "relationship_level";--> statement-breakpoint

ALTER TABLE "facility_representatives" DROP COLUMN IF EXISTS "relationship_level";--> statement-breakpoint

DROP TYPE IF EXISTS "public"."relationship_level";--> statement-breakpoint

ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_relationship_level_range" CHECK ("relationship_level" IS NULL OR ("relationship_level" >= 1 AND "relationship_level" <= 10));--> statement-breakpoint

ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
