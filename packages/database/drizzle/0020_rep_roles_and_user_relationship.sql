CREATE TABLE "user_representative_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"representative_id" text NOT NULL,
	"relationship_level" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_partner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_administrator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_decision_maker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_buyer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_biller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD COLUMN "is_secretary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ADD CONSTRAINT "user_representative_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ADD CONSTRAINT "user_representative_relationships_representative_id_facility_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."facility_representatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_representative_relationships_user_id_representative_id_uidx" ON "user_representative_relationships" USING btree ("user_id","representative_id");--> statement-breakpoint
CREATE INDEX "user_representative_relationships_representative_id_idx" ON "user_representative_relationships" USING btree ("representative_id");--> statement-breakpoint
CREATE INDEX "user_representative_relationships_user_id_idx" ON "user_representative_relationships" USING btree ("user_id");
