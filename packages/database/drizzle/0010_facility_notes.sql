CREATE TABLE "facility_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"facility_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_notes" ADD CONSTRAINT "facility_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_notes" ADD CONSTRAINT "facility_notes_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_notes_facility_id_user_id_created_at_idx" ON "facility_notes" USING btree ("facility_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "facility_notes_user_id_created_at_idx" ON "facility_notes" USING btree ("user_id","created_at");