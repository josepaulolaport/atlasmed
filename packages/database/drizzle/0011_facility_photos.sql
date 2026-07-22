CREATE TABLE "facility_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"content_type" text NOT NULL,
	"uploaded_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_photos_facility_id_created_at_idx" ON "facility_photos" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_photos_storage_key_uidx" ON "facility_photos" USING btree ("storage_key");