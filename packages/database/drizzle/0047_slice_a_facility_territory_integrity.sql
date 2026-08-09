-- Slice A: facility/territory integrity.
-- Order matters: unique targets before composite FKs that reference them.
ALTER TABLE "invitation_territory_assignments" DROP CONSTRAINT "invitation_territory_assignments_territory_id_territories_id_fk";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_state_id_states_id_fk";
--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_municipality_id_municipalities_id_fk";
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP CONSTRAINT "facility_vertical_profiles_manager_zone_id_territories_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_id_state_id_uidx" ON "municipalities" USING btree ("id","state_id");
--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_id_vertical_id_uidx" UNIQUE("id","vertical_id");
--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_manager_territory_id_no_self_check" CHECK ("territories"."manager_territory_id" IS NULL OR "territories"."manager_territory_id" <> "territories"."id");
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_manager_territory_id_territories_id_fk" FOREIGN KEY ("manager_territory_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_rep_territory_id_territories_id_fk" FOREIGN KEY ("rep_territory_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_manager_territory_vertical_fk" FOREIGN KEY ("manager_territory_id","vertical_id") REFERENCES "public"."territories"("id","vertical_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_superseded_by_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."territory_approval_requests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_territory_vertical_fk" FOREIGN KEY ("territory_id","vertical_id") REFERENCES "public"."territories"("id","vertical_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_municipality_state_fk" FOREIGN KEY ("municipality_id","state_id") REFERENCES "public"."municipalities"("id","state_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_manager_zone_vertical_fk" FOREIGN KEY ("manager_zone_id","vertical_id") REFERENCES "public"."territories"("id","vertical_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "territories_boundary_gist_idx" ON "territories" USING gist ("boundary") WHERE "territories"."boundary" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_active_legal_document_uidx" ON "facilities" USING btree ("legal_document_type","legal_document") WHERE "facilities"."deactivated_at" IS NULL AND "facilities"."legal_document" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "facilities_location_gist_idx" ON "facilities" USING gist ("location") WHERE "facilities"."location" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "city";
