CREATE TABLE "invitation_sector_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"sector_id" text NOT NULL,
	"manager_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_territory_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"sector_id" text NOT NULL,
	"territory_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sector_assignments" ADD COLUMN "manager_id" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "birth_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" timestamp;--> statement-breakpoint
ALTER TABLE "invitation_sector_assignments" ADD CONSTRAINT "invitation_sector_assignments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_sector_assignments" ADD CONSTRAINT "invitation_sector_assignments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_sector_assignments" ADD CONSTRAINT "invitation_sector_assignments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_sector_assignments_invitation_id_sector_id_uidx" ON "invitation_sector_assignments" USING btree ("invitation_id","sector_id");--> statement-breakpoint
CREATE INDEX "invitation_sector_assignments_invitation_id_idx" ON "invitation_sector_assignments" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "invitation_sector_assignments_sector_id_idx" ON "invitation_sector_assignments" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "invitation_sector_assignments_manager_id_idx" ON "invitation_sector_assignments" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_territory_assignments_invitation_id_territory_id_uidx" ON "invitation_territory_assignments" USING btree ("invitation_id","territory_id");--> statement-breakpoint
CREATE INDEX "invitation_territory_assignments_invitation_id_idx" ON "invitation_territory_assignments" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "invitation_territory_assignments_sector_id_idx" ON "invitation_territory_assignments" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "invitation_territory_assignments_territory_id_idx" ON "invitation_territory_assignments" USING btree ("territory_id");--> statement-breakpoint
ALTER TABLE "user_sector_assignments" ADD CONSTRAINT "user_sector_assignments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_sector_assignments_manager_id_idx" ON "user_sector_assignments" USING btree ("manager_id");