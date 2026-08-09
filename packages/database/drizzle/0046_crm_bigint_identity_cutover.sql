CREATE TYPE "public"."facility_legal_document_type" AS ENUM('CNPJ', 'CPF');--> statement-breakpoint
CREATE TABLE "clinical_focuses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clinical_focuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"cnes_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "municipalities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"state_id" integer NOT NULL,
	"name" text NOT NULL,
	"ibge_code" text NOT NULL,
	"cnes_code" text,
	"boundary" geometry(MultiPolygon,4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "neighborhoods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"municipality_id" integer NOT NULL,
	"name" text NOT NULL,
	"ibge_code" text NOT NULL,
	"boundary" geometry(MultiPolygon,4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "states_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"ibge_code" text NOT NULL,
	"cnes_code" text,
	"abbreviation" text NOT NULL,
	"boundary" geometry(MultiPolygon,4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_clinical_focuses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "facility_clinical_focuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"facility_id" bigint NOT NULL,
	"clinical_focus_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_classifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "facility_services" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."agreement_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."care_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."deactivation_reasons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facilities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facility_agreements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facility_professionals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facility_representatives" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facility_services" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."facility_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."maintainers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."municipalities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."occupations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."professional_councils" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."professionals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."service_specialties" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry"."states" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_diffs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingestion"."cnes_suggestions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "service_classifications" CASCADE;--> statement-breakpoint
DROP TABLE "services" CASCADE;--> statement-breakpoint
DROP TABLE "facility_services" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."agreement_types" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."care_types" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."deactivation_reasons" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facilities" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facility_agreements" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facility_professionals" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facility_representatives" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facility_services" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."facility_types" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."maintainers" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."municipalities" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."occupations" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."professional_councils" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."professionals" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."service_specialties" CASCADE;--> statement-breakpoint
DROP TABLE "registry"."states" CASCADE;--> statement-breakpoint
DROP TABLE "ingestion"."cnes_diffs" CASCADE;--> statement-breakpoint
DROP TABLE "ingestion"."cnes_runs" CASCADE;--> statement-breakpoint
DROP TABLE "ingestion"."cnes_suggestions" CASCADE;--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_observed_purchase_interval_days_check";--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_purchase_interval_days_check";--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_manual_purchase_interval_days_check";--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_manual_purchase_profile_days_check";--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_purchase_recurrence_sample_size_check";--> statement-breakpoint
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_purchase_interval_source_check";--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."territory_approval_type";--> statement-breakpoint
CREATE TYPE "public"."territory_approval_type" AS ENUM('deactivate_territory');--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "type" SET DATA TYPE "public"."territory_approval_type" USING "type"::"public"."territory_approval_type";--> statement-breakpoint
DROP INDEX "conformity_requirements_applies_to_tax_id_type_idx";--> statement-breakpoint
DROP INDEX "facilities_source_provider_external_source_id_uidx";--> statement-breakpoint
DROP INDEX "facilities_source_provider_cnes_code_uidx";--> statement-breakpoint
DROP INDEX "facilities_source_provider_source_present_idx";--> statement-breakpoint
DROP INDEX "facilities_territory_assignment_status_idx";--> statement-breakpoint
DROP INDEX "facilities_cnes_unit_id_idx";--> statement-breakpoint
DROP INDEX "facilities_active_purchase_funnel_stage_name_id_idx";--> statement-breakpoint
DROP INDEX "facilities_active_purchase_interval_days_name_id_idx";--> statement-breakpoint
DROP INDEX "facilities_active_manual_purchase_profile_name_id_idx";--> statement-breakpoint
DROP INDEX "facilities_active_next_purchase_funnel_transition_date_idx";--> statement-breakpoint
DROP INDEX "facility_professionals_facility_id_source_active_ended_at_idx";--> statement-breakpoint
DROP INDEX "facility_professionals_source_occupation_code_idx";--> statement-breakpoint
DROP INDEX "facility_representatives_facility_id_external_source_key_uidx";--> statement-breakpoint
DROP INDEX "facility_representatives_facility_id_source_active_ended_at_idx";--> statement-breakpoint
DROP INDEX "professionals_source_provider_external_source_id_uidx";--> statement-breakpoint
DROP INDEX "professionals_source_provider_cnes_professional_id_uidx";--> statement-breakpoint
DROP INDEX "professionals_source_provider_source_present_idx";--> statement-breakpoint
-- M11 hard cut: drop FKs, wipe rows, then cast text/cuid -> bigint identity
ALTER TABLE "user_vertical_assignments" DROP CONSTRAINT "user_vertical_assignments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" DROP CONSTRAINT "user_vertical_assignments_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" DROP CONSTRAINT "user_vertical_assignments_assigned_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_role_id_roles_id_fk";--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "password_resets" DROP CONSTRAINT "password_resets_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_granted_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_roles_id_fk";--> statement-breakpoint
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "territories" DROP CONSTRAINT "territories_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "territories" DROP CONSTRAINT "territories_territory_type_id_territory_types_id_fk";--> statement-breakpoint
ALTER TABLE "territory_approval_requests" DROP CONSTRAINT "territory_approval_requests_requester_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "territory_approval_requests" DROP CONSTRAINT "territory_approval_requests_reviewer_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "territory_approval_requests" DROP CONSTRAINT "territory_approval_requests_target_territory_id_territories_id_fk";--> statement-breakpoint
ALTER TABLE "territory_approval_requests" DROP CONSTRAINT "territory_approval_requests_to_territory_id_territories_id_fk";--> statement-breakpoint
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT "user_territory_assignments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT "user_territory_assignments_territory_id_territories_id_fk";--> statement-breakpoint
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT "user_territory_assignments_assigned_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" DROP CONSTRAINT "invitation_territory_assignments_invitation_id_invitations_id_fk";--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" DROP CONSTRAINT "invitation_territory_assignments_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" DROP CONSTRAINT "invitation_territory_assignments_territory_id_territories_id_fk";--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" DROP CONSTRAINT "invitation_vertical_assignments_invitation_id_invitations_id_fk";--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" DROP CONSTRAINT "invitation_vertical_assignments_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "unit_subtypes" DROP CONSTRAINT "unit_subtypes_unit_type_code_unit_types_unit_type_code_fk";--> statement-breakpoint
ALTER TABLE "conformity_records" DROP CONSTRAINT "conformity_records_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "conformity_records" DROP CONSTRAINT "conformity_records_requirement_id_conformity_requirements_id_fk";--> statement-breakpoint
ALTER TABLE "conformity_records" DROP CONSTRAINT "conformity_records_validated_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "conformity_requirements" DROP CONSTRAINT "conformity_requirements_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" DROP CONSTRAINT "facility_consultant_assignments_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" DROP CONSTRAINT "facility_consultant_assignments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" DROP CONSTRAINT "facility_consultant_assignments_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" DROP CONSTRAINT "facility_consultant_assignments_assigned_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP CONSTRAINT "facility_healthcare_provider_shares_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP CONSTRAINT "facility_healthcare_provider_shares_healthcare_provider_id_healthcare_providers_id_fk";--> statement-breakpoint
ALTER TABLE "facility_notes" DROP CONSTRAINT "facility_notes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_notes" DROP CONSTRAINT "facility_notes_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_photos" DROP CONSTRAINT "facility_photos_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_photos" DROP CONSTRAINT "facility_photos_uploaded_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT "facility_professionals_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT "facility_professionals_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT "facility_professionals_confirmed_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP CONSTRAINT "facility_professionals_ended_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP CONSTRAINT "facility_representatives_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP CONSTRAINT "facility_representatives_confirmed_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP CONSTRAINT "facility_vertical_profiles_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP CONSTRAINT "facility_vertical_profiles_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP CONSTRAINT "facility_vertical_profiles_manager_zone_id_territories_id_fk";--> statement-breakpoint
ALTER TABLE "professional_notes" DROP CONSTRAINT "professional_notes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "professional_notes" DROP CONSTRAINT "professional_notes_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "user_professional_relationships" DROP CONSTRAINT "user_professional_relationships_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_professional_relationships" DROP CONSTRAINT "user_professional_relationships_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "user_representative_relationships" DROP CONSTRAINT "user_representative_relationships_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_representative_relationships" DROP CONSTRAINT "user_representative_relationships_representative_id_facility_representatives_id_fk";--> statement-breakpoint
ALTER TABLE "cadastro_submissions" DROP CONSTRAINT "cadastro_submissions_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "cadastro_submissions" DROP CONSTRAINT "cadastro_submissions_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "cadastro_submissions" DROP CONSTRAINT "cadastro_submissions_submitted_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "document_files" DROP CONSTRAINT "document_files_submission_document_id_submission_documents_id_fk";--> statement-breakpoint
ALTER TABLE "document_files" DROP CONSTRAINT "document_files_file_asset_id_file_assets_id_fk";--> statement-breakpoint
ALTER TABLE "file_assets" DROP CONSTRAINT "file_assets_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "processing_events" DROP CONSTRAINT "processing_events_file_asset_id_file_assets_id_fk";--> statement-breakpoint
ALTER TABLE "review_decisions" DROP CONSTRAINT "review_decisions_submission_document_id_submission_documents_id_fk";--> statement-breakpoint
ALTER TABLE "review_decisions" DROP CONSTRAINT "review_decisions_reviewer_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "submission_documents" DROP CONSTRAINT "submission_documents_submission_id_cadastro_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "submission_documents" DROP CONSTRAINT "submission_documents_requirement_id_conformity_requirements_id_fk";--> statement-breakpoint
ALTER TABLE "upload_parts" DROP CONSTRAINT "upload_parts_upload_session_id_upload_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "upload_sessions" DROP CONSTRAINT "upload_sessions_file_asset_id_file_assets_id_fk";--> statement-breakpoint
ALTER TABLE "field_suggestions" DROP CONSTRAINT "field_suggestions_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "field_suggestions" DROP CONSTRAINT "field_suggestions_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "field_suggestions" DROP CONSTRAINT "field_suggestions_submitted_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "field_suggestions" DROP CONSTRAINT "field_suggestions_resolved_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" DROP CONSTRAINT "competitor_product_verticals_competitor_product_id_competitor_products_id_fk";--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" DROP CONSTRAINT "competitor_product_verticals_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP CONSTRAINT "facility_competitor_product_standards_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP CONSTRAINT "facility_competitor_product_standards_competitor_product_id_competitor_products_id_fk";--> statement-breakpoint
ALTER TABLE "product_equivalences" DROP CONSTRAINT "product_equivalences_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "product_equivalences" DROP CONSTRAINT "product_equivalences_competitor_product_id_competitor_products_id_fk";--> statement-breakpoint
ALTER TABLE "product_verticals" DROP CONSTRAINT "product_verticals_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "product_verticals" DROP CONSTRAINT "product_verticals_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "facility_potential_values" DROP CONSTRAINT "facility_potential_values_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_potential_values" DROP CONSTRAINT "facility_potential_values_definition_id_potential_metric_definitions_id_fk";--> statement-breakpoint
ALTER TABLE "facility_potential_values" DROP CONSTRAINT "facility_potential_values_updated_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" DROP CONSTRAINT "potential_metric_definitions_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "product_potential_links" DROP CONSTRAINT "product_potential_links_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "product_potential_links" DROP CONSTRAINT "product_potential_links_definition_id_potential_metric_definitions_id_fk";--> statement-breakpoint
ALTER TABLE "calendar" DROP CONSTRAINT "calendar_owner_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "calendar" DROP CONSTRAINT "calendar_cancelled_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" DROP CONSTRAINT "calendar_command_receipts_owner_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" DROP CONSTRAINT "calendar_occurrence_overrides_calendar_id_calendar_id_fk";--> statement-breakpoint
ALTER TABLE "interaction_events" DROP CONSTRAINT "interaction_events_interaction_id_interactions_id_fk";--> statement-breakpoint
ALTER TABLE "interaction_events" DROP CONSTRAINT "interaction_events_actor_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_calendar_id_calendar_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_agent_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_cancelled_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_corrected_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_visit_id_visits_id_fk";--> statement-breakpoint
ALTER TABLE "order_command_receipts" DROP CONSTRAINT "order_command_receipts_actor_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "order_command_receipts" DROP CONSTRAINT "order_command_receipts_order_id_orders_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_orders_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_vertical_id_business_verticals_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_seller_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_interaction_id_interactions_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_finalized_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_rejected_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_no_billing_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_expense_authorized_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "visits" DROP CONSTRAINT "visits_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "visits" DROP CONSTRAINT "visits_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";--> statement-breakpoint
TRUNCATE TABLE "business_verticals", "user_vertical_assignments", "invitations", "password_resets", "permissions", "roles", "sessions", "users", "verification_tokens", "territories", "territory_approval_requests", "territory_types", "user_territory_assignments", "invitation_territory_assignments", "invitation_vertical_assignments", "deactivation_reasons", "facility_types", "occupations", "unit_subtypes", "unit_types", "clinical_focuses", "municipalities", "neighborhoods", "states", "conformity_records", "conformity_requirements", "facilities", "facility_clinical_focuses", "facility_consultant_assignments", "facility_healthcare_provider_shares", "facility_notes", "facility_photos", "facility_professionals", "facility_representatives", "facility_vertical_profiles", "healthcare_providers", "professional_notes", "professionals", "user_professional_relationships", "user_representative_relationships", "cadastro_submissions", "document_files", "file_assets", "processing_events", "review_decisions", "submission_documents", "upload_parts", "upload_sessions", "field_suggestions", "competitor_product_verticals", "competitor_products", "facility_competitor_product_standards", "product_equivalences", "product_verticals", "products", "facility_potential_values", "potential_metric_definitions", "product_potential_links", "calendar", "calendar_command_receipts", "calendar_occurrence_overrides", "interaction_events", "interactions", "order_command_receipts", "order_items", "orders", "visits", "audit"."audit_logs" CASCADE;--> statement-breakpoint
ALTER TABLE "business_verticals" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "business_verticals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "business_verticals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_vertical_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ALTER COLUMN "assigned_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "accepted_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "resend_count" SET DATA TYPE bigint USING ("resend_count"::bigint);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "invited_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "manager_territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "rep_territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "password_resets" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "password_resets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "password_resets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "password_resets" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "granted_by" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "priority" SET DATA TYPE bigint USING ("priority"::bigint);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "revoked_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "replaced_by_session_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "token_version" SET DATA TYPE bigint USING ("token_version"::bigint);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "token_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "verification_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "territories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "territory_type_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "manager_territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "territory_approval_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "requester_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "reviewer_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "target_territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "to_territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ALTER COLUMN "superseded_by_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_types" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "territory_types" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "territory_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "territory_types" ALTER COLUMN "sort_order" SET DATA TYPE bigint USING ("sort_order"::bigint);--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_territory_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ALTER COLUMN "territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ALTER COLUMN "assigned_by" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "invitation_territory_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ALTER COLUMN "invitation_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ALTER COLUMN "territory_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "invitation_vertical_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ALTER COLUMN "invitation_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_records" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "conformity_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "conformity_records" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_records" ALTER COLUMN "requirement_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_records" ALTER COLUMN "validated_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_requirements" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_requirements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "conformity_requirements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "conformity_requirements" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "conformity_requirements" ALTER COLUMN "max_files" SET DATA TYPE bigint USING ("max_files"::bigint);--> statement-breakpoint
ALTER TABLE "conformity_requirements" ALTER COLUMN "max_files" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facilities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_consultant_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "assigned_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_healthcare_provider_shares_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ALTER COLUMN "healthcare_provider_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_notes" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_notes" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_notes" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_photos" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_photos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_photos" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_photos" ALTER COLUMN "uploaded_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_professionals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "professional_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "confirmed_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_professionals" ALTER COLUMN "ended_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_representatives" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_representatives" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_representatives_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_representatives" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_representatives" ALTER COLUMN "confirmed_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_vertical_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "manager_zone_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "commercial_status" SET DEFAULT 'UNREGISTERED';--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "purchase_status" SET DEFAULT 'NON_BUYER';--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "observed_purchase_interval_days" SET DATA TYPE bigint USING ("observed_purchase_interval_days"::bigint);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "purchase_interval_days" SET DATA TYPE bigint USING ("purchase_interval_days"::bigint);--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "purchase_interval_days" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "manual_purchase_interval_days" SET DATA TYPE bigint USING ("manual_purchase_interval_days"::bigint);--> statement-breakpoint
ALTER TABLE "healthcare_providers" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "healthcare_providers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "healthcare_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "professional_notes" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "professional_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "professional_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "professional_notes" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "professional_notes" ALTER COLUMN "professional_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "professionals" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "professionals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "professionals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_professional_relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ALTER COLUMN "professional_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_representative_relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ALTER COLUMN "representative_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cadastro_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "submitted_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "version" SET DATA TYPE bigint USING ("version"::bigint);--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ALTER COLUMN "version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "submission_document_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "file_asset_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "position" SET DATA TYPE bigint USING ("position"::bigint);--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "position" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "file_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "page_count" SET DATA TYPE bigint USING ("page_count"::bigint);--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "width" SET DATA TYPE bigint USING ("width"::bigint);--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "height" SET DATA TYPE bigint USING ("height"::bigint);--> statement-breakpoint
ALTER TABLE "processing_events" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "processing_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "processing_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "processing_events" ALTER COLUMN "file_asset_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "processing_events" ALTER COLUMN "attempt" SET DATA TYPE bigint USING ("attempt"::bigint);--> statement-breakpoint
ALTER TABLE "processing_events" ALTER COLUMN "attempt" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "review_decisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "submission_document_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "reviewer_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "document_version" SET DATA TYPE bigint USING ("document_version"::bigint);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "submission_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "submission_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "requirement_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "version" SET DATA TYPE bigint USING ("version"::bigint);--> statement-breakpoint
ALTER TABLE "submission_documents" ALTER COLUMN "version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "upload_parts" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "upload_parts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "upload_parts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "upload_parts" ALTER COLUMN "upload_session_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "upload_parts" ALTER COLUMN "part_number" SET DATA TYPE bigint USING ("part_number"::bigint);--> statement-breakpoint
ALTER TABLE "upload_parts" ALTER COLUMN "size_bytes" SET DATA TYPE bigint USING ("size_bytes"::bigint);--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "upload_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "file_asset_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "part_size" SET DATA TYPE bigint USING ("part_size"::bigint);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "field_suggestions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "professional_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "submitted_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "field_suggestions" ALTER COLUMN "resolved_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "competitor_product_verticals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ALTER COLUMN "competitor_product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "competitor_products" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "competitor_products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "competitor_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "competitor_products" ALTER COLUMN "legacy_id" SET DATA TYPE bigint USING ("legacy_id"::bigint);--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "facility_competitor_product_standards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ALTER COLUMN "competitor_product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ALTER COLUMN "standardized_quantity" SET DATA TYPE bigint USING ("standardized_quantity"::bigint);--> statement-breakpoint
ALTER TABLE "product_equivalences" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_equivalences" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "product_equivalences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "product_equivalences" ALTER COLUMN "product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_equivalences" ALTER COLUMN "competitor_product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_verticals" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_verticals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "product_verticals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "product_verticals" ALTER COLUMN "product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_verticals" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "legacy_id" SET DATA TYPE bigint USING ("legacy_id"::bigint);--> statement-breakpoint
ALTER TABLE "facility_potential_values" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_potential_values" ALTER COLUMN "definition_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "facility_potential_values" ALTER COLUMN "updated_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "potential_metric_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ALTER COLUMN "sort_order" SET DATA TYPE bigint USING ("sort_order"::bigint);--> statement-breakpoint
ALTER TABLE "product_potential_links" ALTER COLUMN "product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "product_potential_links" ALTER COLUMN "definition_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "calendar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "owner_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "cancelled_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "calendar_command_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ALTER COLUMN "owner_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ALTER COLUMN "resource_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "calendar_occurrence_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" ALTER COLUMN "calendar_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interaction_events" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interaction_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "interaction_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "interaction_events" ALTER COLUMN "interaction_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interaction_events" ALTER COLUMN "actor_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "interactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "calendar_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "agent_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "cancelled_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "corrected_by_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "interactions" ALTER COLUMN "visit_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_command_receipts" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_command_receipts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "order_command_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "order_command_receipts" ALTER COLUMN "actor_user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_command_receipts" ALTER COLUMN "order_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "legacy_id" SET DATA TYPE bigint USING ("legacy_id"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "order_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "legacy_product_id" SET DATA TYPE bigint USING ("legacy_product_id"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "line_number" SET DATA TYPE bigint USING ("line_number"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "legacy_id" SET DATA TYPE bigint USING ("legacy_id"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "vertical_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "seller_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "professional_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "interaction_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "finalized_by_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "rejected_by_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "no_billing_by_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "expense_authorized_by_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "facility_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "audit"."audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "user_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "actor_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "session_id" SET DATA TYPE bigint USING (0);--> statement-breakpoint
-- re-add pre-existing FKs after bigint cutover
ALTER TABLE "user_vertical_assignments" ADD CONSTRAINT "user_vertical_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ADD CONSTRAINT "user_vertical_assignments_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" ADD CONSTRAINT "user_vertical_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_territory_type_id_territory_types_id_fk" FOREIGN KEY ("territory_type_id") REFERENCES "territory_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_target_territory_id_territories_id_fk" FOREIGN KEY ("target_territory_id") REFERENCES "territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_to_territory_id_territories_id_fk" FOREIGN KEY ("to_territory_id") REFERENCES "territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "territories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" ADD CONSTRAINT "invitation_territory_assignments_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "territories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ADD CONSTRAINT "invitation_vertical_assignments_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" ADD CONSTRAINT "invitation_vertical_assignments_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_subtypes" ADD CONSTRAINT "unit_subtypes_unit_type_code_unit_types_unit_type_code_fk" FOREIGN KEY ("unit_type_code") REFERENCES "unit_types"("unit_type_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_requirement_id_conformity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "conformity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD CONSTRAINT "conformity_requirements_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_healthcare_provider_id_healthcare_providers_id_fk" FOREIGN KEY ("healthcare_provider_id") REFERENCES "healthcare_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_notes" ADD CONSTRAINT "facility_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_notes" ADD CONSTRAINT "facility_notes_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_manager_zone_id_territories_id_fk" FOREIGN KEY ("manager_zone_id") REFERENCES "territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ADD CONSTRAINT "user_professional_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_professional_relationships" ADD CONSTRAINT "user_professional_relationships_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ADD CONSTRAINT "user_representative_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_representative_relationships" ADD CONSTRAINT "user_representative_relationships_representative_id_facility_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "facility_representatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_submission_document_id_submission_documents_id_fk" FOREIGN KEY ("submission_document_id") REFERENCES "submission_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_events" ADD CONSTRAINT "processing_events_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_submission_document_id_submission_documents_id_fk" FOREIGN KEY ("submission_document_id") REFERENCES "submission_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_submission_id_cadastro_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "cadastro_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_requirement_id_conformity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "conformity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_parts" ADD CONSTRAINT "upload_parts_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ADD CONSTRAINT "competitor_product_verticals_competitor_product_id_competitor_products_id_fk" FOREIGN KEY ("competitor_product_id") REFERENCES "competitor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" ADD CONSTRAINT "competitor_product_verticals_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ADD CONSTRAINT "facility_competitor_product_standards_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ADD CONSTRAINT "facility_competitor_product_standards_competitor_product_id_competitor_products_id_fk" FOREIGN KEY ("competitor_product_id") REFERENCES "competitor_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_competitor_product_id_competitor_products_id_fk" FOREIGN KEY ("competitor_product_id") REFERENCES "competitor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_verticals" ADD CONSTRAINT "product_verticals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_verticals" ADD CONSTRAINT "product_verticals_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_definition_id_potential_metric_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "potential_metric_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ADD CONSTRAINT "potential_metric_definitions_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_definition_id_potential_metric_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "potential_metric_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_command_receipts" ADD CONSTRAINT "calendar_command_receipts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_occurrence_overrides" ADD CONSTRAINT "calendar_occurrence_overrides_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_command_receipts" ADD CONSTRAINT "order_command_receipts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_command_receipts" ADD CONSTRAINT "order_command_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_finalized_by_id_users_id_fk" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_no_billing_by_id_users_id_fk" FOREIGN KEY ("no_billing_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_expense_authorized_by_id_users_id_fk" FOREIGN KEY ("expense_authorized_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD COLUMN "applies_to_legal_document_type" "facility_legal_document_type";--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "legal_document_type" "facility_legal_document_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "legal_document" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "state_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "municipality_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_clinical_focuses" ADD CONSTRAINT "facility_clinical_focuses_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_clinical_focuses" ADD CONSTRAINT "facility_clinical_focuses_clinical_focus_id_clinical_focuses_id_fk" FOREIGN KEY ("clinical_focus_id") REFERENCES "public"."clinical_focuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_focuses_name_uidx" ON "clinical_focuses" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_focuses_cnes_code_uidx" ON "clinical_focuses" USING btree ("cnes_code") WHERE "clinical_focuses"."cnes_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "clinical_focuses_is_active_idx" ON "clinical_focuses" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_ibge_code_uidx" ON "municipalities" USING btree ("ibge_code");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_cnes_code_uidx" ON "municipalities" USING btree ("cnes_code") WHERE "municipalities"."cnes_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "municipalities_state_id_idx" ON "municipalities" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "municipalities_name_idx" ON "municipalities" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhoods_ibge_code_uidx" ON "neighborhoods" USING btree ("ibge_code");--> statement-breakpoint
CREATE INDEX "neighborhoods_municipality_id_idx" ON "neighborhoods" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "neighborhoods_name_idx" ON "neighborhoods" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "states_ibge_code_uidx" ON "states" USING btree ("ibge_code");--> statement-breakpoint
CREATE UNIQUE INDEX "states_abbreviation_uidx" ON "states" USING btree ("abbreviation");--> statement-breakpoint
CREATE UNIQUE INDEX "states_cnes_code_uidx" ON "states" USING btree ("cnes_code") WHERE "states"."cnes_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "facility_clinical_focuses_facility_id_clinical_focus_id_uidx" ON "facility_clinical_focuses" USING btree ("facility_id","clinical_focus_id");--> statement-breakpoint
CREATE INDEX "facility_clinical_focuses_facility_id_idx" ON "facility_clinical_focuses" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_clinical_focuses_clinical_focus_id_idx" ON "facility_clinical_focuses" USING btree ("clinical_focus_id");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conformity_requirements_applies_to_legal_document_type_idx" ON "conformity_requirements" USING btree ("applies_to_legal_document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_cnes_code_uidx" ON "facilities" USING btree ("cnes_code") WHERE "facilities"."cnes_code" IS NOT NULL AND "facilities"."deactivated_at" IS NULL;--> statement-breakpoint
CREATE INDEX "facilities_state_id_idx" ON "facilities" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "facilities_municipality_id_idx" ON "facilities" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "facility_representatives_facility_id_ended_at_idx" ON "facility_representatives" USING btree ("facility_id","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_cnes_professional_id_uidx" ON "professionals" USING btree ("cnes_professional_id") WHERE "professionals"."cnes_professional_id" IS NOT NULL AND "professionals"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "boundary_min_lng";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "boundary_min_lat";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "boundary_max_lng";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "boundary_max_lat";--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN "boundary_area_sq_km";--> statement-breakpoint
ALTER TABLE "territory_types" DROP COLUMN "assigns_clinics";--> statement-breakpoint
ALTER TABLE "territory_types" DROP COLUMN "assignable_to_users";--> statement-breakpoint
ALTER TABLE "territory_types" DROP COLUMN "assignable_to_managers";--> statement-breakpoint
ALTER TABLE "conformity_requirements" DROP COLUMN "applies_to_tax_id_type";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "cnes_unit_id";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "is_active_in_registry";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "tax_id_type";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "cnpj";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "cpf";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "fax_number";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "observed_purchase_interval_days";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "purchase_interval_days";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "purchase_interval_source";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "manual_purchase_profile";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "manual_purchase_interval_days";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "last_valid_purchase_date";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "purchase_recurrence_sample_size";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "purchase_funnel_stage";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "next_purchase_funnel_transition_date";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "purchase_recurrence_calculated_at";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "unit_type";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "unit_subtype";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "territory_assignment_status";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "territory_assignment_source";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_provider";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "external_source_id";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_content_hash";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_first_seen_at";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_last_seen_at";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_present";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "source_tracked";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "manually_edited_at";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP COLUMN "source_first_seen_at";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP COLUMN "source_last_seen_at";--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" DROP COLUMN "manually_edited_at";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP COLUMN "source_occupation_code";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP COLUMN "source_active";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP COLUMN "source_first_seen_at";--> statement-breakpoint
ALTER TABLE "facility_professionals" DROP COLUMN "source_last_seen_at";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP COLUMN "source_provider";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP COLUMN "external_source_key";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP COLUMN "source_active";--> statement-breakpoint
ALTER TABLE "facility_representatives" DROP COLUMN "manually_edited_at";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_provider";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "external_source_id";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_content_hash";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_first_seen_at";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_last_seen_at";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_present";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "source_tracked";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "manually_edited_at";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP COLUMN "source_first_seen_at";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP COLUMN "source_last_seen_at";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "legacy_supplier_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "legacy_created_at";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "surgery_type";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "surgery_subtype";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "usd_exchange_rate";--> statement-breakpoint
DROP TYPE "public"."facility_tax_id_type";--> statement-breakpoint
DROP TYPE "public"."healthcare_provider_share_source";--> statement-breakpoint
DROP TYPE "public"."territory_assignment_source";--> statement-breakpoint
DROP TYPE "public"."territory_assignment_status";--> statement-breakpoint
DROP TYPE "ingestion"."cnes_diff_scope";--> statement-breakpoint
DROP TYPE "ingestion"."cnes_run_phase";--> statement-breakpoint
DROP TYPE "ingestion"."cnes_run_status";--> statement-breakpoint
DROP TYPE "ingestion"."cnes_suggestion_status";--> statement-breakpoint
DROP TYPE "ingestion"."cnes_suggestion_type";--> statement-breakpoint
DROP SCHEMA "registry";
--> statement-breakpoint
DROP SCHEMA "ingestion";
