CREATE TABLE "professional_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"facility_id" text NOT NULL,
	"visited_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_notes_professional_id_user_id_created_at_idx" ON "professional_notes" USING btree ("professional_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_notes_user_id_created_at_idx" ON "professional_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "visits_user_id_visited_at_idx" ON "visits" USING btree ("user_id","visited_at");--> statement-breakpoint
CREATE INDEX "visits_facility_id_visited_at_idx" ON "visits" USING btree ("facility_id","visited_at");