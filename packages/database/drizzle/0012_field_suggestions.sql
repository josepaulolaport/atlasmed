CREATE TYPE "public"."field_suggestion_kind" AS ENUM('FIELD_CHANGE', 'DEACTIVATION');--> statement-breakpoint
CREATE TYPE "public"."field_suggestion_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "field_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "field_suggestion_kind" NOT NULL,
	"status" "field_suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"facility_id" text NOT NULL,
	"professional_id" text,
	"field_key" text,
	"current_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposed_value" jsonb,
	"reason" text,
	"submitted_by_user_id" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_suggestions_status_submitted_at_idx" ON "field_suggestions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "field_suggestions_facility_submitter_submitted_at_idx" ON "field_suggestions" USING btree ("facility_id","submitted_by_user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "field_suggestions_facility_field_status_idx" ON "field_suggestions" USING btree ("facility_id","field_key","status");--> statement-breakpoint
CREATE INDEX "field_suggestions_facility_kind_status_idx" ON "field_suggestions" USING btree ("facility_id","kind","status");