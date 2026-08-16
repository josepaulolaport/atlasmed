CREATE TYPE "public"."roteiro_bucket" AS ENUM('MANTER', 'RECUPERAR', 'PROSPECTAR');--> statement-breakpoint
CREATE TYPE "public"."roteiro_modality_source" AS ENUM('SUGGESTED', 'REP_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."roteiro_reach_mode" AS ENUM('LIVRE', 'ANCORA');--> statement-breakpoint
CREATE TYPE "public"."roteiro_rejection_reason" AS ENUM('MUITO_LONGE', 'JA_VISITEI', 'NAO_E_MEU_CLIENTE', 'FECHADA', 'SEM_INTERESSE', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."roteiro_status" AS ENUM('DRAFT', 'CONFIRMED', 'DISCARDED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."roteiro_stop_source" AS ENUM('SUGGESTED', 'SUBSTITUTED', 'MANUAL', 'ANCHOR');--> statement-breakpoint
CREATE TYPE "public"."roteiro_travel_source" AS ENUM('MAPBOX', 'ESTIMATED');--> statement-breakpoint
CREATE TABLE "roteiro_params" (
	"vertical_id" bigint PRIMARY KEY NOT NULL,
	"daily_limit" smallint DEFAULT 5 NOT NULL,
	"weights" jsonb NOT NULL,
	"bucket_ratios" jsonb NOT NULL,
	"cooldown_days" jsonb NOT NULL,
	"coverage_horizon_days" jsonb NOT NULL,
	"service_minutes" jsonb NOT NULL,
	"unit_type_policy" jsonb NOT NULL,
	"reach_radius_km" integer DEFAULT 60 NOT NULL,
	"detour_budget_km" integer DEFAULT 20 NOT NULL,
	"tau_seconds" integer DEFAULT 900 NOT NULL,
	"remote_threshold_seconds" integer DEFAULT 2700 NOT NULL,
	"headroom_unknown" numeric(4, 3) DEFAULT '0.400' NOT NULL,
	"workday_start" time DEFAULT '08:00' NOT NULL,
	"workday_end" time DEFAULT '18:00' NOT NULL,
	"lunch_start" time DEFAULT '12:00' NOT NULL,
	"lunch_minutes" smallint DEFAULT 60 NOT NULL,
	"max_generations_per_day" smallint DEFAULT 20 NOT NULL,
	"updated_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiro_params_daily_limit_range_check" CHECK ("roteiro_params"."daily_limit" between 1 and 12),
	CONSTRAINT "roteiro_params_reach_radius_km_positive_check" CHECK ("roteiro_params"."reach_radius_km" > 0),
	CONSTRAINT "roteiro_params_detour_budget_km_positive_check" CHECK ("roteiro_params"."detour_budget_km" > 0),
	CONSTRAINT "roteiro_params_tau_seconds_positive_check" CHECK ("roteiro_params"."tau_seconds" > 0),
	CONSTRAINT "roteiro_params_remote_threshold_positive_check" CHECK ("roteiro_params"."remote_threshold_seconds" > 0),
	CONSTRAINT "roteiro_params_headroom_unknown_range_check" CHECK ("roteiro_params"."headroom_unknown" >= 0 and "roteiro_params"."headroom_unknown" <= 1),
	CONSTRAINT "roteiro_params_lunch_minutes_non_negative_check" CHECK ("roteiro_params"."lunch_minutes" >= 0),
	CONSTRAINT "roteiro_params_workday_order_check" CHECK ("roteiro_params"."workday_end" > "roteiro_params"."workday_start"),
	CONSTRAINT "roteiro_params_max_generations_positive_check" CHECK ("roteiro_params"."max_generations_per_day" > 0),
	CONSTRAINT "roteiro_params_weights_sum_to_one_check" CHECK (round((
        ("roteiro_params"."weights"->>'t')::numeric + ("roteiro_params"."weights"->>'h')::numeric +
        ("roteiro_params"."weights"->>'n')::numeric + ("roteiro_params"."weights"->>'v')::numeric +
        ("roteiro_params"."weights"->>'k')::numeric + ("roteiro_params"."weights"->>'c')::numeric +
        ("roteiro_params"."weights"->>'q')::numeric), 4) = 1.0000)
);
--> statement-breakpoint
CREATE TABLE "roteiro_stop_rejections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roteiro_stop_rejections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"roteiro_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"rejected_profile_id" bigint NOT NULL,
	"replaced_by_profile_id" bigint,
	"reason" "roteiro_rejection_reason",
	"reason_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roteiro_stops" (
	"roteiro_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"facility_vertical_profile_id" bigint NOT NULL,
	"bucket" "roteiro_bucket" NOT NULL,
	"modality" "interaction_modality" NOT NULL,
	"modality_source" "roteiro_modality_source" DEFAULT 'SUGGESTED' NOT NULL,
	"merit_score" numeric(6, 5) NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"travel_seconds_from_prev" integer,
	"service_minutes" smallint NOT NULL,
	"planned_starts_at" timestamp with time zone NOT NULL,
	"planned_ends_at" timestamp with time zone NOT NULL,
	"source" "roteiro_stop_source" DEFAULT 'SUGGESTED' NOT NULL,
	"is_coverage_slot" boolean DEFAULT false NOT NULL,
	"calendar_id" bigint,
	"interaction_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiro_stops_pkey" PRIMARY KEY("roteiro_id","position"),
	CONSTRAINT "roteiro_stops_roteiro_id_profile_id_key" UNIQUE("roteiro_id","facility_vertical_profile_id"),
	CONSTRAINT "roteiro_stops_position_non_negative_check" CHECK ("roteiro_stops"."position" >= 0),
	CONSTRAINT "roteiro_stops_service_minutes_positive_check" CHECK ("roteiro_stops"."service_minutes" > 0),
	CONSTRAINT "roteiro_stops_travel_seconds_non_negative_check" CHECK ("roteiro_stops"."travel_seconds_from_prev" is null or "roteiro_stops"."travel_seconds_from_prev" >= 0),
	CONSTRAINT "roteiro_stops_planned_window_check" CHECK ("roteiro_stops"."planned_ends_at" > "roteiro_stops"."planned_starts_at"),
	CONSTRAINT "roteiro_stops_merit_score_range_check" CHECK ("roteiro_stops"."merit_score" >= 0 and "roteiro_stops"."merit_score" <= 1),
	CONSTRAINT "roteiro_stops_remote_has_no_travel_check" CHECK ("roteiro_stops"."modality" <> 'REMOTE' or "roteiro_stops"."travel_seconds_from_prev" is null),
	CONSTRAINT "roteiro_stops_confirmation_link_check" CHECK (("roteiro_stops"."calendar_id" is null) = ("roteiro_stops"."interaction_id" is null))
);
--> statement-breakpoint
CREATE TABLE "roteiros" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roteiros_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"vertical_id" bigint NOT NULL,
	"scope_date" date NOT NULL,
	"week_group_id" uuid,
	"origin" geometry(Point,4326) NOT NULL,
	"reach_mode" "roteiro_reach_mode" NOT NULL,
	"anchor_profile_id" bigint,
	"reach_bound_km" integer NOT NULL,
	"status" "roteiro_status" DEFAULT 'DRAFT' NOT NULL,
	"travel_source" "roteiro_travel_source" NOT NULL,
	"params_snapshot" jsonb NOT NULL,
	"notices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"discarded_at" timestamp with time zone,
	"discard_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiros_reach_bound_km_positive_check" CHECK ("roteiros"."reach_bound_km" > 0),
	CONSTRAINT "roteiros_anchor_matches_reach_mode_check" CHECK (("roteiros"."reach_mode" = 'ANCORA') = ("roteiros"."anchor_profile_id" is not null)),
	CONSTRAINT "roteiros_confirmed_metadata_check" CHECK (("roteiros"."status" = 'CONFIRMED') = ("roteiros"."confirmed_at" is not null)),
	CONSTRAINT "roteiros_discarded_metadata_check" CHECK (("roteiros"."status" = 'DISCARDED') = ("roteiros"."discarded_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD COLUMN "last_suggested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roteiro_params" ADD CONSTRAINT "roteiro_params_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_params" ADD CONSTRAINT "roteiro_params_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD CONSTRAINT "roteiro_stop_rejections_roteiro_id_roteiros_id_fk" FOREIGN KEY ("roteiro_id") REFERENCES "public"."roteiros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD CONSTRAINT "roteiro_stop_rejections_rejected_profile_id_fk" FOREIGN KEY ("rejected_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD CONSTRAINT "roteiro_stop_rejections_replaced_profile_id_fk" FOREIGN KEY ("replaced_by_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stops" ADD CONSTRAINT "roteiro_stops_roteiro_id_roteiros_id_fk" FOREIGN KEY ("roteiro_id") REFERENCES "public"."roteiros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stops" ADD CONSTRAINT "roteiro_stops_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stops" ADD CONSTRAINT "roteiro_stops_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stops" ADD CONSTRAINT "roteiro_stops_profile_id_fk" FOREIGN KEY ("facility_vertical_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiros" ADD CONSTRAINT "roteiros_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiros" ADD CONSTRAINT "roteiros_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiros" ADD CONSTRAINT "roteiros_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiros" ADD CONSTRAINT "roteiros_anchor_profile_id_fk" FOREIGN KEY ("anchor_profile_id") REFERENCES "public"."facility_vertical_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roteiro_stop_rejections_roteiro_id_idx" ON "roteiro_stop_rejections" USING btree ("roteiro_id");--> statement-breakpoint
CREATE INDEX "roteiro_stop_rejections_rejected_profile_id_idx" ON "roteiro_stop_rejections" USING btree ("rejected_profile_id");--> statement-breakpoint
CREATE INDEX "roteiro_stop_rejections_reason_created_at_idx" ON "roteiro_stop_rejections" USING btree ("reason","created_at");--> statement-breakpoint
CREATE INDEX "roteiro_stops_profile_id_idx" ON "roteiro_stops" USING btree ("facility_vertical_profile_id");--> statement-breakpoint
CREATE INDEX "roteiro_stops_interaction_id_idx" ON "roteiro_stops" USING btree ("interaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roteiros_user_id_scope_date_live_uidx" ON "roteiros" USING btree ("user_id","scope_date") WHERE status in ('DRAFT', 'CONFIRMED');--> statement-breakpoint
CREATE INDEX "roteiros_user_id_scope_date_idx" ON "roteiros" USING btree ("user_id","scope_date");--> statement-breakpoint
CREATE INDEX "roteiros_status_scope_date_idx" ON "roteiros" USING btree ("status","scope_date");--> statement-breakpoint
CREATE INDEX "roteiros_vertical_id_scope_date_idx" ON "roteiros" USING btree ("vertical_id","scope_date");--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_coverage_rotation_idx" ON "facility_vertical_profiles" USING btree ("vertical_id","last_suggested_at" NULLS FIRST) WHERE "facility_vertical_profiles"."is_active" = true;