CREATE TABLE "user_professional_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"relationship_level" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ADD CONSTRAINT "user_professional_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ADD CONSTRAINT "user_professional_relationships_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_professional_relationships_user_id_professional_id_uidx" ON "user_professional_relationships" USING btree ("user_id","professional_id");--> statement-breakpoint
CREATE INDEX "user_professional_relationships_professional_id_idx" ON "user_professional_relationships" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "user_professional_relationships_user_id_idx" ON "user_professional_relationships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP COLUMN "relationship_level";