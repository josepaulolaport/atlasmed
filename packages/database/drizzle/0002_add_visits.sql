CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"facility_id" text NOT NULL,
	"visited_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visits_user_id_visited_at_idx" ON "visits" USING btree ("user_id","visited_at");--> statement-breakpoint
CREATE INDEX "visits_facility_id_visited_at_idx" ON "visits" USING btree ("facility_id","visited_at");