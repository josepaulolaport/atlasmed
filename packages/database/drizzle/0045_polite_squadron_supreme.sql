CREATE TYPE "public"."calendar_event_kind" AS ENUM('INTERACTION', 'PERSONAL_BLOCK');--> statement-breakpoint
CREATE TYPE "public"."calendar_occurrence_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."calendar_recurrence" AS ENUM('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."calendar_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."interaction_event_source" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."interaction_modality" AS ENUM('IN_PERSON', 'REMOTE');--> statement-breakpoint
CREATE TYPE "public"."interaction_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "calendar" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"kind" "calendar_event_kind" NOT NULL,
	"title" text NOT NULL,
	"anchor_local_date" date NOT NULL,
	"anchor_local_time" time NOT NULL,
	"time_zone" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"first_starts_at" timestamp with time zone,
	"first_ends_at" timestamp with time zone,
	"recurrence" "calendar_recurrence" DEFAULT 'NONE' NOT NULL,
	"recurrence_until" date,
	"recurrence_count" integer,
	"status" "calendar_status" DEFAULT 'ACTIVE' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" text,
	"cancellation_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_duration_minutes_positive_check" CHECK ("calendar"."duration_minutes" > 0),
	CONSTRAINT "calendar_first_occurrence_instants_check" CHECK (("calendar"."first_starts_at" is null and "calendar"."first_ends_at" is null) or ("calendar"."first_starts_at" is not null and "calendar"."first_ends_at" is not null and "calendar"."first_ends_at" > "calendar"."first_starts_at" and "calendar"."first_ends_at" - "calendar"."first_starts_at" = "calendar"."duration_minutes" * interval '1 minute')),
	CONSTRAINT "calendar_recurrence_until_anchor_check" CHECK ("calendar"."recurrence_until" is null or "calendar"."recurrence_until" >= "calendar"."anchor_local_date"),
	CONSTRAINT "calendar_recurrence_none_bounds_check" CHECK ("calendar"."recurrence" <> 'NONE' or ("calendar"."recurrence_until" is null and "calendar"."recurrence_count" is null)),
	CONSTRAINT "calendar_recurrence_bounds_mutually_exclusive_check" CHECK ("calendar"."recurrence_until" is null or "calendar"."recurrence_count" is null),
	CONSTRAINT "calendar_recurrence_count_positive_check" CHECK ("calendar"."recurrence_count" is null or "calendar"."recurrence_count" > 0),
	CONSTRAINT "calendar_cancellation_metadata_check" CHECK (("calendar"."status" = 'ACTIVE' and "calendar"."cancelled_at" is null and "calendar"."cancelled_by_user_id" is null and "calendar"."cancellation_reason" is null) or ("calendar"."status" = 'CANCELLED' and "calendar"."cancelled_at" is not null and "calendar"."cancelled_by_user_id" is not null and "calendar"."cancellation_reason" is not null and btrim("calendar"."cancellation_reason") <> ''))
);
--> statement-breakpoint
CREATE TABLE "calendar_command_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"command_key" text NOT NULL,
	"command_kind" text NOT NULL,
	"resource_id" text,
	"request_fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_command_receipts_owner_user_id_command_key_key" UNIQUE("owner_user_id","command_key")
);
--> statement-breakpoint
CREATE TABLE "calendar_occurrence_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"recurrence_key" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "calendar_occurrence_status" DEFAULT 'ACTIVE' NOT NULL,
	"reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "calendar_occurrence_overrides_calendar_id_recurrence_key_key" UNIQUE("calendar_id","recurrence_key"),
	CONSTRAINT "calendar_occurrence_overrides_ends_after_starts_check" CHECK ("calendar_occurrence_overrides"."ends_at" > "calendar_occurrence_overrides"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "interaction_events" (
	"id" text PRIMARY KEY NOT NULL,
	"interaction_id" text NOT NULL,
	"actor_user_id" text,
	"source" "interaction_event_source" DEFAULT 'USER' NOT NULL,
	"previous_status" "interaction_status",
	"new_status" "interaction_status" NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"recurrence_key" text NOT NULL,
	"facility_id" text NOT NULL,
	"agent_user_id" text NOT NULL,
	"modality" "interaction_modality" NOT NULL,
	"status" "interaction_status" DEFAULT 'SCHEDULED' NOT NULL,
	"actual_started_at" timestamp with time zone,
	"actual_ended_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" text,
	"cancellation_reason" text,
	"corrected_at" timestamp with time zone,
	"corrected_by_user_id" text,
	"correction_reason" text,
	"visit_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interactions_calendar_id_recurrence_key_key" UNIQUE("calendar_id","recurrence_key"),
	CONSTRAINT "interactions_visit_id_key" UNIQUE("visit_id"),
	CONSTRAINT "interactions_actual_ends_after_starts_check" CHECK ("interactions"."actual_ended_at" is null or ("interactions"."actual_started_at" is not null and "interactions"."actual_ended_at" > "interactions"."actual_started_at")),
	CONSTRAINT "interactions_cancellation_metadata_check" CHECK (("interactions"."cancelled_at" is null and "interactions"."cancelled_by_user_id" is null and "interactions"."cancellation_reason" is null) or ("interactions"."cancelled_at" is not null and "interactions"."cancelled_by_user_id" is not null and "interactions"."cancellation_reason" is not null and btrim("interactions"."cancellation_reason") <> '' and "interactions"."status" = 'CANCELLED')),
	CONSTRAINT "interactions_correction_metadata_check" CHECK (("interactions"."corrected_at" is null and "interactions"."corrected_by_user_id" is null and "interactions"."correction_reason" is null) or ("interactions"."corrected_at" is not null and "interactions"."corrected_by_user_id" is not null and "interactions"."correction_reason" is not null and btrim("interactions"."correction_reason") <> '' and "interactions"."status" = 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "order_command_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"command_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"order_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_command_receipts_actor_user_id_command_key_key" UNIQUE("actor_user_id","command_key")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "interaction_id" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ADD CONSTRAINT "calendar_command_receipts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" ADD CONSTRAINT "calendar_occurrence_overrides_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_command_receipts" ADD CONSTRAINT "order_command_receipts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_command_receipts" ADD CONSTRAINT "order_command_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_owner_user_id_first_starts_at_idx" ON "calendar" USING btree ("owner_user_id","first_starts_at");--> statement-breakpoint
CREATE INDEX "calendar_owner_user_id_kind_first_starts_at_idx" ON "calendar" USING btree ("owner_user_id","kind","first_starts_at");--> statement-breakpoint
CREATE INDEX "calendar_command_receipts_resource_id_idx" ON "calendar_command_receipts" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "calendar_occurrence_overrides_calendar_id_starts_at_idx" ON "calendar_occurrence_overrides" USING btree ("calendar_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_occurrence_overrides_status_starts_at_idx" ON "calendar_occurrence_overrides" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "interaction_events_interaction_id_created_at_idx" ON "interaction_events" USING btree ("interaction_id","created_at");--> statement-breakpoint
CREATE INDEX "interaction_events_actor_user_id_created_at_idx" ON "interaction_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "interactions_facility_id_status_idx" ON "interactions" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "interactions_agent_user_id_status_idx" ON "interactions" USING btree ("agent_user_id","status");--> statement-breakpoint
CREATE INDEX "interactions_status_idx" ON "interactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_command_receipts_order_id_idx" ON "order_command_receipts" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_interaction_id_idx" ON "orders" USING btree ("interaction_id");