CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "registry";
--> statement-breakpoint
CREATE SCHEMA "ingestion";
--> statement-breakpoint
CREATE TYPE "public"."auth_session_device_type" AS ENUM('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."auth_session_type" AS ENUM('WEB', 'MOBILE', 'API');--> statement-breakpoint
CREATE TYPE "public"."commercial_status" AS ENUM('REGISTERED', 'ACTIVE', 'SUSPENDED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."conformity_record_status" AS ENUM('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."conformity_status" AS ENUM('INCOMPLETE', 'COMPLETE', 'EXPIRING_SOON', 'NON_CONFORMING');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('PROFESSIONAL', 'DECISOR', 'COMPRADOR');--> statement-breakpoint
CREATE TYPE "public"."healthcare_provider_share_source" AS ENUM('MANUAL', 'REGISTRY', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."healthcare_provider_type" AS ENUM('PRIVATE', 'PUBLIC', 'MIXED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('NON_BUYER', 'LOW_BUYER', 'REGULAR_BUYER', 'HIGH_BUYER');--> statement-breakpoint
CREATE TYPE "public"."relationship_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."territory_approval_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."territory_approval_type" AS ENUM('create_territory', 'reparent_territory', 'deactivate_territory', 'clinic_territory_change');--> statement-breakpoint
CREATE TYPE "public"."territory_assignment_source" AS ENUM('geo', 'manual');--> statement-breakpoint
CREATE TYPE "public"."territory_assignment_status" AS ENUM('assigned', 'unassigned', 'ambiguous');--> statement-breakpoint
CREATE TYPE "public"."territory_node_type" AS ENUM('root', 'region', 'state', 'intermediate', 'patch');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."verification_token_type" AS ENUM('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'EMAIL_CHANGE', 'PHONE_CHANGE');--> statement-breakpoint
CREATE TYPE "audit"."audit_event_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "audit"."audit_event_type" AS ENUM('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'USER_INVITE', 'USER_ACCEPT_INVITE', 'USER_DEACTIVATE', 'USER_ACTIVATE', 'USER_SUSPEND', 'USER_UNSUSPEND', 'USER_MANAGER_ASSIGNED', 'USER_MANAGER_REMOVED', 'USER_TERRITORY_ASSIGNED', 'USER_TERRITORY_REVOKED', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'EMAIL_CHANGE', 'PHONE_CHANGE', 'EMAIL_VERIFY', 'PHONE_VERIFY', 'ROLE_CHANGE', 'SESSION_CREATE', 'SESSION_REVOKE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'TWO_FACTOR_ENABLE', 'TWO_FACTOR_DISABLE', 'SUSPICIOUS_ACTIVITY', 'DATA_ACCESS', 'DATA_EXPORT', 'REGISTRY_INGESTION_STARTED', 'REGISTRY_INGESTION_COMPLETED', 'REGISTRY_SUGGESTION_APPROVED', 'REGISTRY_SUGGESTION_REJECTED', 'DOCTOR_CLINIC_CONFIRMED', 'DOCTOR_CLINIC_ASSOCIATION_ENDED', 'DOCTOR_CLINIC_MANUAL_ASSOCIATED', 'CLINIC_REACTIVATED');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_diff_scope" AS ENUM('WAREHOUSE', 'CRM');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_run_phase" AS ENUM('DISCOVERING', 'DOWNLOADING', 'EXTRACTING', 'PREFLIGHT', 'PARSING', 'LOADING', 'VALIDATING', 'RECONCILING', 'PROMOTING', 'SYNCING', 'FAILED');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_suggestion_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "ingestion"."cnes_suggestion_type" AS ENUM('FACILITY_FIELD_UPDATE', 'PROFESSIONAL_FIELD_UPDATE', 'FACILITY_REGISTRY_DEACTIVATED', 'FACILITY_REGISTRY_REACTIVATED', 'FACILITY_PROFESSIONAL_REMOVAL', 'FACILITY_PROFESSIONAL_ADD', 'FACILITY_REPRESENTATIVE_REMOVAL', 'FACILITY_REPRESENTATIVE_ADD', 'FACILITY_REPRESENTATIVE_FIELD_UPDATE', 'CLINIC_REMOVAL', 'CLINIC_REACTIVATION', 'DOCTOR_CLINIC_REMOVAL');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phone_number" text,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" text,
	"revoked_at" timestamp,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_resend_at" timestamp,
	"role_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"manager_id" text,
	"manager_territory_id" text,
	"rep_territory_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"action" text NOT NULL,
	"conditions" json,
	"granted_by" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"revoked_by_user_id" text,
	"replaced_by_session_id" text,
	"previous_refresh_token_hash" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"browser_name" text,
	"browser_version" text,
	"os_name" text,
	"device_type" "auth_session_device_type" DEFAULT 'UNKNOWN' NOT NULL,
	"device_name" text,
	"device_fingerprint" text,
	"session_type" "auth_session_type" DEFAULT 'WEB' NOT NULL,
	"ip_address" text,
	"ip_country" text,
	"ip_city" text,
	"suspicious_activity" boolean DEFAULT false NOT NULL,
	"last_ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"phone_number" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"phone_verified_at" timestamp,
	"password_hash" text NOT NULL,
	"password_history" text[] DEFAULT '{}' NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp,
	"password_changed_at" timestamp,
	"deactivated_at" timestamp,
	"suspended_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"deleted_at" timestamp,
	"metadata" json,
	"role_id" text NOT NULL,
	"manager_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "verification_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"new_value" text,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"node_type" "territory_node_type" NOT NULL,
	"territory_type_id" text NOT NULL,
	"country_code" text,
	"region_slug" text,
	"state_code" text,
	"parent_id" text,
	"manager_territory_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" text,
	"boundary" geometry(MultiPolygon,4326),
	"centroid" geometry(Point,4326),
	"boundary_min_lng" double precision,
	"boundary_min_lat" double precision,
	"boundary_max_lng" double precision,
	"boundary_max_lat" double precision,
	"boundary_area_sq_km" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "territories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "territory_approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "territory_approval_type" NOT NULL,
	"status" "territory_approval_status" DEFAULT 'pending' NOT NULL,
	"requester_id" text NOT NULL,
	"reviewer_id" text,
	"entity_payload" json DEFAULT '{}'::json NOT NULL,
	"target_territory_id" text,
	"facility_id" text,
	"to_territory_id" text,
	"reason" text,
	"resolution_note" text,
	"superseded_by_id" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territory_closure" (
	"ancestor_id" text NOT NULL,
	"descendant_id" text NOT NULL,
	"depth" integer NOT NULL,
	CONSTRAINT "territory_closure_ancestor_id_descendant_id_pk" PRIMARY KEY("ancestor_id","descendant_id")
);
--> statement-breakpoint
CREATE TABLE "territory_types" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"can_have_boundary" boolean DEFAULT true NOT NULL,
	"assigns_clinics" boolean DEFAULT false NOT NULL,
	"assignable_to_users" boolean DEFAULT false NOT NULL,
	"assignable_to_managers" boolean DEFAULT false NOT NULL,
	"is_country_level" boolean DEFAULT false NOT NULL,
	"block_sibling_overlap" boolean DEFAULT false NOT NULL,
	"participates_in_grouping_hierarchy" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "territory_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_territory_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"territory_id" text NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conformity_records" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"status" "conformity_record_status" DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp,
	"validated_at" timestamp,
	"expires_at" timestamp,
	"validated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conformity_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sector_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conformity_requirements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"trade_name" text,
	"cnes_code" text,
	"facility_type_code" text,
	"is_active_in_registry" boolean DEFAULT true NOT NULL,
	"registry_deactivation_code" text,
	"cnpj" text,
	"cpf" text,
	"country" text,
	"state" text,
	"city" text,
	"neighborhood" text,
	"street_address" text,
	"street_number" text,
	"address_complement" text,
	"postal_code" text,
	"location" geometry(Point,4326),
	"phone_number" text,
	"fax_number" text,
	"email" text,
	"website_url" text,
	"primary_sector_id" text,
	"conformity_status" "conformity_status" DEFAULT 'INCOMPLETE' NOT NULL,
	"commercial_status" "commercial_status",
	"purchase_status" "purchase_status",
	"image_url" text,
	"territory_id" text,
	"territory_assignment_status" "territory_assignment_status" DEFAULT 'unassigned' NOT NULL,
	"territory_assignment_source" "territory_assignment_source" DEFAULT 'geo' NOT NULL,
	"source_provider" text,
	"external_source_id" text,
	"source_content_hash" text,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"source_present" boolean DEFAULT false NOT NULL,
	"source_tracked" boolean DEFAULT false NOT NULL,
	"manually_edited_at" timestamp,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_consultant_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"assigned_by_user_id" text,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_healthcare_provider_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"healthcare_provider_id" text NOT NULL,
	"share_percent" text NOT NULL,
	"source" "healthcare_provider_share_source" DEFAULT 'MANUAL' NOT NULL,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"manually_edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"professional_id" text NOT NULL,
	"facility_id" text NOT NULL,
	"occupation_code" text DEFAULT 'LEGACY' NOT NULL,
	"specialty_label" text,
	"employment_type_code" text,
	"source_occupation_code" text,
	"is_prescriber" boolean DEFAULT false NOT NULL,
	"is_buyer" boolean DEFAULT false NOT NULL,
	"is_decision_maker" boolean DEFAULT false NOT NULL,
	"is_partner" boolean DEFAULT false NOT NULL,
	"relationship_level" "relationship_level",
	"notes" text,
	"source_active" boolean DEFAULT false NOT NULL,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"confirmed_at" timestamp,
	"confirmed_by_user_id" text,
	"ended_at" timestamp,
	"ended_by_user_id" text,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_representatives" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"representative_name" text NOT NULL,
	"role_title" text,
	"email" text,
	"tax_id" text,
	"contact_type" "contact_type" DEFAULT 'PROFESSIONAL' NOT NULL,
	"relationship_level" text,
	"phone" text,
	"notes" text,
	"source_provider" text,
	"external_source_key" text,
	"source_active" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp,
	"confirmed_by_user_id" text,
	"ended_at" timestamp,
	"manually_edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healthcare_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "healthcare_provider_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"full_name" text,
	"social_name" text,
	"tax_id" text,
	"birth_date" timestamp,
	"mobile_phone" text,
	"landline_phone" text,
	"email" text,
	"website_url" text,
	"image_url" text,
	"favorite_team" text,
	"favorite_sport" text,
	"hobbies" text,
	"notes" text,
	"primary_specialty_label" text,
	"crm_council" text,
	"crm_number" text,
	"crm_state" text,
	"source_provider" text,
	"external_source_id" text,
	"source_content_hash" text,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"source_present" boolean DEFAULT false NOT NULL,
	"source_tracked" boolean DEFAULT false NOT NULL,
	"manually_edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sector_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"event_type" "audit"."audit_event_type" NOT NULL,
	"severity" "audit"."audit_event_severity" DEFAULT 'INFO' NOT NULL,
	"actor" text,
	"actor_id" text,
	"resource" text,
	"resource_id" text,
	"action" text NOT NULL,
	"details" json,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"outcome" text,
	"error_message" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."agreement_types" (
	"agreement_code" text PRIMARY KEY NOT NULL,
	"agreement_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."care_types" (
	"care_type_code" text PRIMARY KEY NOT NULL,
	"care_type_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."deactivation_reasons" (
	"deactivation_code" text PRIMARY KEY NOT NULL,
	"deactivation_reason" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."facilities" (
	"facility_id" text PRIMARY KEY NOT NULL,
	"cnes_code" text,
	"legal_name" text,
	"trade_name" text,
	"street_address" text,
	"street_number" text,
	"address_complement" text,
	"neighborhood" text,
	"postal_code" text,
	"municipality_id" text,
	"health_region_id" text,
	"phone_number" text,
	"fax_number" text,
	"email" text,
	"website_url" text,
	"location" geometry(Point,4326),
	"tax_id_cnpj" text,
	"tax_id_cpf" text,
	"owner_tax_id" text,
	"legal_entity_type_code" text,
	"entity_type" text,
	"facility_type_code" text,
	"primary_activity_code" text,
	"unit_type_code" text,
	"operating_hours_code" text,
	"deactivation_reason_code" text,
	"is_24_7" integer,
	"is_philanthropic" integer,
	"has_internet" integer,
	"has_formal_contract" integer,
	"license_issue_date" text,
	"sanitary_license_expiry" text,
	"last_updated_date" text,
	"updated_by_user" text,
	"unit_type_name" text,
	"unit_subtype_name" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_agreements" (
	"facility_id" text NOT NULL,
	"care_type_code" text NOT NULL,
	"agreement_code" text NOT NULL,
	"updated_by_user" text,
	"last_updated_date" text,
	"origin_updated_date" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "facility_agreements_facility_id_care_type_code_agreement_code_pk" PRIMARY KEY("facility_id","care_type_code","agreement_code")
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_professionals" (
	"facility_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"occupation_code" text NOT NULL,
	"municipality_id" text,
	"service_area_id" text,
	"team_sequence_number" integer,
	"service_type" text,
	"employment_type_code" text,
	"start_date" text,
	"termination_date" text,
	"micro_area_code" text,
	"other_team_cnes" text,
	"last_updated_date" text,
	"updated_by_user" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "facility_professionals_facility_id_professional_id_occupation_code_pk" PRIMARY KEY("facility_id","professional_id","occupation_code")
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_representatives" (
	"facility_id" text PRIMARY KEY NOT NULL,
	"representative_name" text NOT NULL,
	"role_title" text,
	"email" text,
	"tax_id" text,
	"updated_by_user" text,
	"last_updated_date" text,
	"origin_updated_date" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."facility_types" (
	"facility_type_code" text PRIMARY KEY NOT NULL,
	"facility_type_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."maintainers" (
	"tax_id" text PRIMARY KEY NOT NULL,
	"legal_name" text,
	"bank_code" text,
	"branch_number" text,
	"account_number" text,
	"street_address" text,
	"street_number" text,
	"address_complement" text,
	"neighborhood" text,
	"postal_code" text,
	"municipality_id" text,
	"health_region_id" text,
	"phone_number" text,
	"form_filled_date" text,
	"fms_fes_status" text,
	"fms_fes_tax_id" text,
	"legal_entity_type_code" text,
	"last_updated_date" text,
	"updated_by_user" text,
	"manager_code" text,
	"manager_municipality_id" text,
	"origin_updated_date" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."municipalities" (
	"municipality_id" text PRIMARY KEY NOT NULL,
	"municipality_name" text NOT NULL,
	"state_code" text NOT NULL,
	"registration_type" text,
	"pact_type" text,
	"data_submission_type" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."occupations" (
	"occupation_code" text PRIMARY KEY NOT NULL,
	"occupation_name" text NOT NULL,
	"professional_classification" text,
	"is_health_occupation" text,
	"is_regulated" text,
	"reference_year" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."professional_councils" (
	"council_code" text PRIMARY KEY NOT NULL,
	"council_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."professionals" (
	"professional_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"social_name" text,
	"tax_id" text,
	"health_card_number" text,
	"nationality_code" text,
	"last_updated_date" text,
	"updated_by_user" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."service_specialties" (
	"service_code" text PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "registry"."states" (
	"state_code" text PRIMARY KEY NOT NULL,
	"state_name" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ingestion"."cnes_diffs" (
	"id" text PRIMARY KEY NOT NULL,
	"cnes_run_id" text NOT NULL,
	"scope" "ingestion"."cnes_diff_scope" NOT NULL,
	"entity_type" text NOT NULL,
	"external_source_id" text,
	"diff_type" text NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion"."cnes_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_provider" text NOT NULL,
	"status" "ingestion"."cnes_run_status" DEFAULT 'RUNNING' NOT NULL,
	"phase" "ingestion"."cnes_run_phase",
	"phase_started_at" timestamp,
	"temporal_workflow_id" text,
	"reference_ano" integer,
	"reference_mes" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"promoted_at" timestamp,
	"stats" json,
	"validation_report" json,
	"archive_manifest" json,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ingestion"."cnes_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"cnes_run_id" text NOT NULL,
	"type" "ingestion"."cnes_suggestion_type" NOT NULL,
	"status" "ingestion"."cnes_suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"facility_id" text,
	"professional_id" text,
	"facility_professional_id" text,
	"reason" text,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"suggested_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"resolution_note" text
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_territory_type_id_territory_types_id_fk" FOREIGN KEY ("territory_type_id") REFERENCES "public"."territory_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_target_territory_id_territories_id_fk" FOREIGN KEY ("target_territory_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_to_territory_id_territories_id_fk" FOREIGN KEY ("to_territory_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_ancestor_id_territories_id_fk" FOREIGN KEY ("ancestor_id") REFERENCES "public"."territories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_descendant_id_territories_id_fk" FOREIGN KEY ("descendant_id") REFERENCES "public"."territories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_requirement_id_conformity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."conformity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD CONSTRAINT "conformity_requirements_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_primary_sector_id_sectors_id_fk" FOREIGN KEY ("primary_sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_healthcare_provider_id_healthcare_providers_id_fk" FOREIGN KEY ("healthcare_provider_id") REFERENCES "public"."healthcare_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_diffs" ADD CONSTRAINT "cnes_diffs_cnes_run_id_cnes_runs_id_fk" FOREIGN KEY ("cnes_run_id") REFERENCES "ingestion"."cnes_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_suggestions" ADD CONSTRAINT "cnes_suggestions_cnes_run_id_cnes_runs_id_fk" FOREIGN KEY ("cnes_run_id") REFERENCES "ingestion"."cnes_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_suggestions" ADD CONSTRAINT "cnes_suggestions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_suggestions" ADD CONSTRAINT "cnes_suggestions_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_suggestions" ADD CONSTRAINT "cnes_suggestions_facility_professional_id_facility_professionals_id_fk" FOREIGN KEY ("facility_professional_id") REFERENCES "public"."facility_professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_phone_number_idx" ON "invitations" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_accepted_by_user_id_idx" ON "invitations" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE INDEX "invitations_invited_by_user_id_idx" ON "invitations" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "invitations_manager_id_idx" ON "invitations" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "invitations_manager_territory_id_idx" ON "invitations" USING btree ("manager_territory_id");--> statement-breakpoint
CREATE INDEX "invitations_rep_territory_id_idx" ON "invitations" USING btree ("rep_territory_id");--> statement-breakpoint
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_resets_token_hash_idx" ON "password_resets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "permissions_user_id_idx" ON "permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "permissions_resource_resource_id_idx" ON "permissions" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "permissions_user_id_resource_idx" ON "permissions" USING btree ("user_id","resource");--> statement-breakpoint
CREATE INDEX "permissions_expires_at_idx" ON "permissions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_user_id_resource_resource_id_action_uidx" ON "permissions" USING btree ("user_id","resource","resource_id","action");--> statement-breakpoint
CREATE INDEX "roles_priority_idx" ON "roles" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_previous_refresh_token_hash_idx" ON "sessions" USING btree ("previous_refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_revoked_at_idx" ON "sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_session_type_idx" ON "sessions" USING btree ("session_type");--> statement-breakpoint
CREATE INDEX "sessions_device_fingerprint_idx" ON "sessions" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "sessions_suspicious_activity_idx" ON "sessions" USING btree ("suspicious_activity");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_phone_number_idx" ON "users" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_manager_id_idx" ON "users" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_id_idx" ON "verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_token_hash_idx" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "verification_tokens_type_idx" ON "verification_tokens" USING btree ("type");--> statement-breakpoint
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "territories_slug_uidx" ON "territories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "territories_parent_id_idx" ON "territories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "territories_manager_territory_id_idx" ON "territories" USING btree ("manager_territory_id");--> statement-breakpoint
CREATE INDEX "territories_is_active_idx" ON "territories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "territories_node_type_idx" ON "territories" USING btree ("node_type");--> statement-breakpoint
CREATE INDEX "territories_country_code_idx" ON "territories" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "territories_territory_type_id_idx" ON "territories" USING btree ("territory_type_id");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_status_type_idx" ON "territory_approval_requests" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_requester_id_idx" ON "territory_approval_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_target_territory_id_status_idx" ON "territory_approval_requests" USING btree ("target_territory_id","status");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_facility_id_status_type_idx" ON "territory_approval_requests" USING btree ("facility_id","status","type");--> statement-breakpoint
CREATE INDEX "territory_closure_descendant_id_idx" ON "territory_closure" USING btree ("descendant_id");--> statement-breakpoint
CREATE INDEX "territory_types_is_active_idx" ON "territory_types" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "user_territory_assignments_user_id_territory_id_uidx" ON "user_territory_assignments" USING btree ("user_id","territory_id");--> statement-breakpoint
CREATE INDEX "user_territory_assignments_user_id_idx" ON "user_territory_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_territory_assignments_territory_id_idx" ON "user_territory_assignments" USING btree ("territory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conformity_records_facility_id_requirement_id_uidx" ON "conformity_records" USING btree ("facility_id","requirement_id");--> statement-breakpoint
CREATE INDEX "conformity_records_facility_id_idx" ON "conformity_records" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "conformity_records_requirement_id_idx" ON "conformity_records" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "conformity_records_status_idx" ON "conformity_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conformity_requirements_sector_id_idx" ON "conformity_requirements" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "conformity_requirements_is_active_idx" ON "conformity_requirements" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_source_provider_external_source_id_uidx" ON "facilities" USING btree ("source_provider","external_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_source_provider_cnes_code_uidx" ON "facilities" USING btree ("source_provider","cnes_code");--> statement-breakpoint
CREATE INDEX "facilities_territory_id_idx" ON "facilities" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "facilities_deactivated_at_idx" ON "facilities" USING btree ("deactivated_at");--> statement-breakpoint
CREATE INDEX "facilities_name_idx" ON "facilities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "facilities_source_provider_source_present_idx" ON "facilities" USING btree ("source_provider","source_present");--> statement-breakpoint
CREATE INDEX "facilities_territory_assignment_status_idx" ON "facilities" USING btree ("territory_assignment_status");--> statement-breakpoint
CREATE INDEX "facilities_primary_sector_id_idx" ON "facilities" USING btree ("primary_sector_id");--> statement-breakpoint
CREATE INDEX "facilities_conformity_status_idx" ON "facilities" USING btree ("conformity_status");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_facility_id_idx" ON "facility_consultant_assignments" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_user_id_idx" ON "facility_consultant_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_facility_id_ended_at_idx" ON "facility_consultant_assignments" USING btree ("facility_id","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_healthcare_provider_shares_facility_id_provider_id_uidx" ON "facility_healthcare_provider_shares" USING btree ("facility_id","healthcare_provider_id");--> statement-breakpoint
CREATE INDEX "facility_healthcare_provider_shares_facility_id_idx" ON "facility_healthcare_provider_shares" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_healthcare_provider_shares_healthcare_provider_id_idx" ON "facility_healthcare_provider_shares" USING btree ("healthcare_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_professionals_facility_id_professional_id_occupation_code_uidx" ON "facility_professionals" USING btree ("facility_id","professional_id","occupation_code");--> statement-breakpoint
CREATE INDEX "facility_professionals_professional_id_idx" ON "facility_professionals" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "facility_professionals_facility_id_idx" ON "facility_professionals" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_professionals_facility_id_source_active_ended_at_idx" ON "facility_professionals" USING btree ("facility_id","source_active","ended_at");--> statement-breakpoint
CREATE INDEX "facility_professionals_facility_id_confirmed_at_ended_at_idx" ON "facility_professionals" USING btree ("facility_id","confirmed_at","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_representatives_facility_id_external_source_key_uidx" ON "facility_representatives" USING btree ("facility_id","external_source_key");--> statement-breakpoint
CREATE INDEX "facility_representatives_facility_id_idx" ON "facility_representatives" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_representatives_facility_id_source_active_ended_at_idx" ON "facility_representatives" USING btree ("facility_id","source_active","ended_at");--> statement-breakpoint
CREATE INDEX "healthcare_providers_is_active_idx" ON "healthcare_providers" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_source_provider_external_source_id_uidx" ON "professionals" USING btree ("source_provider","external_source_id");--> statement-breakpoint
CREATE INDEX "professionals_deleted_at_idx" ON "professionals" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "professionals_last_name_first_name_idx" ON "professionals" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "professionals_source_provider_source_present_idx" ON "professionals" USING btree ("source_provider","source_present");--> statement-breakpoint
CREATE INDEX "professionals_tax_id_idx" ON "professionals" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "sectors_is_active_idx" ON "sectors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "products_sector_id_idx" ON "products" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "products_is_active_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_event_type_idx" ON "audit"."audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "audit_logs_severity_idx" ON "audit"."audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit"."audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_id_idx" ON "audit"."audit_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_session_id_idx" ON "audit"."audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "cnes_diffs_cnes_run_id_idx" ON "ingestion"."cnes_diffs" USING btree ("cnes_run_id");--> statement-breakpoint
CREATE INDEX "cnes_diffs_scope_entity_type_idx" ON "ingestion"."cnes_diffs" USING btree ("scope","entity_type");--> statement-breakpoint
CREATE INDEX "cnes_runs_source_provider_started_at_idx" ON "ingestion"."cnes_runs" USING btree ("source_provider","started_at");--> statement-breakpoint
CREATE INDEX "cnes_runs_status_idx" ON "ingestion"."cnes_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cnes_runs_temporal_workflow_id_idx" ON "ingestion"."cnes_runs" USING btree ("temporal_workflow_id");--> statement-breakpoint
CREATE INDEX "cnes_suggestions_status_type_idx" ON "ingestion"."cnes_suggestions" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "cnes_suggestions_facility_id_status_idx" ON "ingestion"."cnes_suggestions" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "cnes_suggestions_cnes_run_id_idx" ON "ingestion"."cnes_suggestions" USING btree ("cnes_run_id");