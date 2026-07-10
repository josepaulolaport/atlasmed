CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "registry";
--> statement-breakpoint
CREATE TYPE "public"."AuthSessionDeviceType" AS ENUM('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."AuthSessionType" AS ENUM('WEB', 'MOBILE', 'API');--> statement-breakpoint
CREATE TYPE "public"."CommercialStatus" AS ENUM('REGISTERED', 'COMMERCIALLY_ACTIVE', 'COMMERCIALLY_SUSPENDED', 'COMMERCIALLY_INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."ConformityRecordStatus" AS ENUM('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."ConformityStatus" AS ENUM('INCOMPLETE', 'COMPLETE', 'EXPIRING_SOON', 'NON_CONFORMING');--> statement-breakpoint
CREATE TYPE "public"."ContactType" AS ENUM('PROFESSIONAL', 'DECISOR', 'COMPRADOR');--> statement-breakpoint
CREATE TYPE "public"."HealthcareProviderShareSource" AS ENUM('MANUAL', 'REGISTRY', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."HealthcareProviderType" AS ENUM('PRIVATE', 'PUBLIC', 'MIXED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."IngestionDiffScope" AS ENUM('WAREHOUSE', 'CRM');--> statement-breakpoint
CREATE TYPE "public"."IngestionRunPhase" AS ENUM('DISCOVERING', 'DOWNLOADING', 'EXTRACTING', 'PREFLIGHT', 'PARSING', 'LOADING', 'VALIDATING', 'RECONCILING', 'PROMOTING', 'SYNCING', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."IngestionRunStatus" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."IngestionSuggestionStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."IngestionSuggestionType" AS ENUM('FACILITY_FIELD_UPDATE', 'PROFESSIONAL_FIELD_UPDATE', 'FACILITY_REGISTRY_DEACTIVATED', 'FACILITY_REGISTRY_REACTIVATED', 'FACILITY_PROFESSIONAL_REMOVAL', 'FACILITY_PROFESSIONAL_ADD', 'FACILITY_REPRESENTATIVE_REMOVAL', 'FACILITY_REPRESENTATIVE_ADD', 'FACILITY_REPRESENTATIVE_FIELD_UPDATE', 'CLINIC_REMOVAL', 'CLINIC_REACTIVATION', 'DOCTOR_CLINIC_REMOVAL');--> statement-breakpoint
CREATE TYPE "public"."InvitationStatus" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."PurchaseStatus" AS ENUM('NAO_COMPRA', 'COMPRA', 'COMPRA_POUCO', 'COMPRA_MUITO');--> statement-breakpoint
CREATE TYPE "public"."RelationshipLevel" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."TerritoryApprovalStatus" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."TerritoryApprovalType" AS ENUM('create_territory', 'reparent_territory', 'deactivate_territory', 'clinic_territory_change');--> statement-breakpoint
CREATE TYPE "public"."TerritoryAssignmentSource" AS ENUM('geo', 'manual');--> statement-breakpoint
CREATE TYPE "public"."TerritoryAssignmentStatus" AS ENUM('assigned', 'unassigned', 'ambiguous');--> statement-breakpoint
CREATE TYPE "public"."TerritoryNodeType" AS ENUM('root', 'region', 'state', 'intermediate', 'patch');--> statement-breakpoint
CREATE TYPE "public"."UserStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."VerificationTokenType" AS ENUM('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'EMAIL_CHANGE', 'PHONE_CHANGE');--> statement-breakpoint
CREATE TYPE "audit"."AuditEventSeverity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "audit"."AuditEventType" AS ENUM('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'USER_INVITE', 'USER_ACCEPT_INVITE', 'USER_DEACTIVATE', 'USER_ACTIVATE', 'USER_SUSPEND', 'USER_UNSUSPEND', 'USER_MANAGER_ASSIGNED', 'USER_MANAGER_REMOVED', 'USER_TERRITORY_ASSIGNED', 'USER_TERRITORY_REVOKED', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'EMAIL_CHANGE', 'PHONE_CHANGE', 'EMAIL_VERIFY', 'PHONE_VERIFY', 'ROLE_CHANGE', 'SESSION_CREATE', 'SESSION_REVOKE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'TWO_FACTOR_ENABLE', 'TWO_FACTOR_DISABLE', 'SUSPICIOUS_ACTIVITY', 'DATA_ACCESS', 'DATA_EXPORT', 'REGISTRY_INGESTION_STARTED', 'REGISTRY_INGESTION_COMPLETED', 'REGISTRY_SUGGESTION_APPROVED', 'REGISTRY_SUGGESTION_REJECTED', 'DOCTOR_CLINIC_CONFIRMED', 'DOCTOR_CLINIC_ASSOCIATION_ENDED', 'DOCTOR_CLINIC_MANUAL_ASSOCIATED', 'CLINIC_REACTIVATED');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phoneNumber" text,
	"tokenHash" text NOT NULL,
	"status" "InvitationStatus" DEFAULT 'PENDING' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"acceptedByUserId" text,
	"revokedAt" timestamp,
	"resendCount" integer DEFAULT 0 NOT NULL,
	"lastResendAt" timestamp,
	"roleId" text NOT NULL,
	"invitedByUserId" text NOT NULL,
	"firstName" text,
	"lastName" text,
	"managerId" text,
	"managerTerritoryId" text,
	"repTerritoryId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"resource" text NOT NULL,
	"resourceId" text,
	"action" text NOT NULL,
	"conditions" json,
	"grantedBy" text,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"refreshTokenHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"revokedReason" text,
	"revokedByUserId" text,
	"replacedBySessionId" text,
	"previousRefreshTokenHash" text,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL,
	"userAgent" text,
	"browserName" text,
	"browserVersion" text,
	"osName" text,
	"deviceType" "AuthSessionDeviceType" DEFAULT 'UNKNOWN' NOT NULL,
	"deviceName" text,
	"deviceFingerprint" text,
	"sessionType" "AuthSessionType" DEFAULT 'WEB' NOT NULL,
	"ipAddress" text,
	"ipCountry" text,
	"ipCity" text,
	"suspiciousActivity" boolean DEFAULT false NOT NULL,
	"lastIpAddress" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refreshTokenHash_unique" UNIQUE("refreshTokenHash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"phoneNumber" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"phoneVerified" boolean DEFAULT false NOT NULL,
	"emailVerifiedAt" timestamp,
	"phoneVerifiedAt" timestamp,
	"passwordHash" text NOT NULL,
	"passwordHistory" text[] DEFAULT '{}' NOT NULL,
	"firstName" text,
	"lastName" text,
	"avatarUrl" text,
	"status" "UserStatus" DEFAULT 'PENDING' NOT NULL,
	"tokenVersion" integer DEFAULT 1 NOT NULL,
	"lastLoginAt" timestamp,
	"passwordChangedAt" timestamp,
	"deactivatedAt" timestamp,
	"suspendedAt" timestamp,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"twoFactorSecret" text,
	"deletedAt" timestamp,
	"metadata" json,
	"roleId" text NOT NULL,
	"managerId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_phoneNumber_unique" UNIQUE("phoneNumber")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "VerificationTokenType" NOT NULL,
	"tokenHash" text NOT NULL,
	"newValue" text,
	"expiresAt" timestamp NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"nodeType" "TerritoryNodeType" NOT NULL,
	"territoryTypeId" text NOT NULL,
	"countryCode" text,
	"regionSlug" text,
	"stateCode" text,
	"parentId" text,
	"managerTerritoryId" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"organizationId" text,
	"boundary" geometry(MultiPolygon,4326),
	"centroid" geometry(Point,4326),
	"boundaryMinLng" double precision,
	"boundaryMinLat" double precision,
	"boundaryMaxLng" double precision,
	"boundaryMaxLat" double precision,
	"boundaryAreaSqKm" double precision,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "territories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "territory_approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "TerritoryApprovalType" NOT NULL,
	"status" "TerritoryApprovalStatus" DEFAULT 'pending' NOT NULL,
	"requesterId" text NOT NULL,
	"reviewerId" text,
	"entityPayload" json DEFAULT '{}'::json NOT NULL,
	"targetTerritoryId" text,
	"facilityId" text,
	"toTerritoryId" text,
	"reason" text,
	"resolutionNote" text,
	"supersededById" text,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territory_closure" (
	"ancestorId" text NOT NULL,
	"descendantId" text NOT NULL,
	"depth" integer NOT NULL,
	CONSTRAINT "territory_closure_ancestorId_descendantId_pk" PRIMARY KEY("ancestorId","descendantId")
);
--> statement-breakpoint
CREATE TABLE "territory_types" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"canHaveBoundary" boolean DEFAULT true NOT NULL,
	"assignsClinics" boolean DEFAULT false NOT NULL,
	"assignableToUsers" boolean DEFAULT false NOT NULL,
	"assignableToManagers" boolean DEFAULT false NOT NULL,
	"isCountryLevel" boolean DEFAULT false NOT NULL,
	"blockSiblingOverlap" boolean DEFAULT false NOT NULL,
	"participatesInGroupingHierarchy" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "territory_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_territory_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"territoryId" text NOT NULL,
	"assignedBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conformity_records" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"status" "ConformityRecordStatus" DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp,
	"validated_at" timestamp,
	"expires_at" timestamp,
	"validated_by_user_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conformity_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sector_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conformity_requirements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"location" geometry(Point,4326),
	"cnes_code" text,
	"legal_name" text,
	"trade_name" text,
	"street_address" text,
	"street_number" text,
	"address_complement" text,
	"neighborhood" text,
	"postal_code" text,
	"phone_number" text,
	"fax_number" text,
	"email" text,
	"website_url" text,
	"tax_id_cnpj" text,
	"tax_id_cpf" text,
	"owner_tax_id" text,
	"facility_type_code" text,
	"registry_deactivation_code" text,
	"is_active_in_registry" boolean DEFAULT true NOT NULL,
	"reference_municipality_code" text,
	"conformityStatus" "ConformityStatus" DEFAULT 'INCOMPLETE' NOT NULL,
	"commercial_status" "CommercialStatus",
	"purchase_status" "PurchaseStatus",
	"city" text,
	"state_code" text,
	"primary_sector_id" text,
	"image_url" text,
	"territoryId" text,
	"territoryAssignmentStatus" "TerritoryAssignmentStatus" DEFAULT 'unassigned' NOT NULL,
	"territoryAssignmentSource" "TerritoryAssignmentSource" DEFAULT 'geo' NOT NULL,
	"sourceProvider" text,
	"externalSourceId" text,
	"sourceContentHash" text,
	"sourceFirstSeenAt" timestamp,
	"sourceLastSeenAt" timestamp,
	"sourcePresent" boolean DEFAULT false NOT NULL,
	"sourceTracked" boolean DEFAULT false NOT NULL,
	"manuallyEditedAt" timestamp,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_consultant_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"facilityId" text NOT NULL,
	"userId" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"assigned_by_user_id" text,
	"end_reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_healthcare_provider_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"healthcare_provider_id" text NOT NULL,
	"share_percent" text NOT NULL,
	"source" "HealthcareProviderShareSource" DEFAULT 'MANUAL' NOT NULL,
	"source_first_seen_at" timestamp,
	"source_last_seen_at" timestamp,
	"manually_edited_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text NOT NULL,
	"facilityId" text NOT NULL,
	"occupation_code" text DEFAULT 'LEGACY' NOT NULL,
	"specialty_label" text,
	"employment_type_code" text,
	"source_occupation_code" text,
	"is_prescriber" boolean DEFAULT false NOT NULL,
	"is_buyer" boolean DEFAULT false NOT NULL,
	"is_decision_maker" boolean DEFAULT false NOT NULL,
	"is_partner" boolean DEFAULT false NOT NULL,
	"relationship_level" "RelationshipLevel",
	"notes" text,
	"sourceActive" boolean DEFAULT false NOT NULL,
	"sourceFirstSeenAt" timestamp,
	"sourceLastSeenAt" timestamp,
	"confirmedAt" timestamp,
	"confirmedByUserId" text,
	"endedAt" timestamp,
	"endedByUserId" text,
	"endReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_representatives" (
	"id" text PRIMARY KEY NOT NULL,
	"facilityId" text NOT NULL,
	"representative_name" text NOT NULL,
	"role_title" text,
	"email" text,
	"tax_id" text,
	"contact_type" "ContactType" DEFAULT 'PROFESSIONAL' NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healthcare_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "HealthcareProviderType" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
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
	"sourceProvider" text,
	"externalSourceId" text,
	"sourceContentHash" text,
	"sourceFirstSeenAt" timestamp,
	"sourceLastSeenAt" timestamp,
	"sourcePresent" boolean DEFAULT false NOT NULL,
	"sourceTracked" boolean DEFAULT false NOT NULL,
	"manuallyEditedAt" timestamp,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sector_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ingestion_diffs" (
	"id" text PRIMARY KEY NOT NULL,
	"ingestionRunId" text NOT NULL,
	"scope" "IngestionDiffScope" NOT NULL,
	"entityType" text NOT NULL,
	"externalSourceId" text,
	"diffType" text NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceProvider" text NOT NULL,
	"status" "IngestionRunStatus" DEFAULT 'RUNNING' NOT NULL,
	"phase" "IngestionRunPhase",
	"phaseStartedAt" timestamp,
	"temporalWorkflowId" text,
	"referenceAno" integer,
	"referenceMes" integer,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"promotedAt" timestamp,
	"stats" json,
	"validationReport" json,
	"archiveManifest" json,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ingestion_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"ingestionRunId" text NOT NULL,
	"type" "IngestionSuggestionType" NOT NULL,
	"status" "IngestionSuggestionStatus" DEFAULT 'PENDING' NOT NULL,
	"facilityId" text,
	"professionalId" text,
	"facilityProfessionalId" text,
	"reason" text,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"suggestedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"resolvedByUserId" text,
	"resolutionNote" text
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"eventType" "audit"."AuditEventType" NOT NULL,
	"severity" "audit"."AuditEventSeverity" DEFAULT 'INFO' NOT NULL,
	"actor" text,
	"actorId" text,
	"resource" text,
	"resourceId" text,
	"action" text NOT NULL,
	"details" json,
	"ipAddress" text,
	"userAgent" text,
	"sessionId" text,
	"outcome" text,
	"errorMessage" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedByUserId_users_id_fk" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_managerId_users_id_fk" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_territoryTypeId_territory_types_id_fk" FOREIGN KEY ("territoryTypeId") REFERENCES "public"."territory_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_targetTerritoryId_territories_id_fk" FOREIGN KEY ("targetTerritoryId") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_toTerritoryId_territories_id_fk" FOREIGN KEY ("toTerritoryId") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_ancestorId_territories_id_fk" FOREIGN KEY ("ancestorId") REFERENCES "public"."territories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_descendantId_territories_id_fk" FOREIGN KEY ("descendantId") REFERENCES "public"."territories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_territoryId_territories_id_fk" FOREIGN KEY ("territoryId") REFERENCES "public"."territories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_requirement_id_conformity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."conformity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conformity_requirements" ADD CONSTRAINT "conformity_requirements_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_primary_sector_id_sectors_id_fk" FOREIGN KEY ("primary_sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_territoryId_territories_id_fk" FOREIGN KEY ("territoryId") REFERENCES "public"."territories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_facilityId_facilities_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_healthcare_provider_id_healthcare_providers_id_fk" FOREIGN KEY ("healthcare_provider_id") REFERENCES "public"."healthcare_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_professionalId_professionals_id_fk" FOREIGN KEY ("professionalId") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_professionals" ADD CONSTRAINT "facility_professionals_facilityId_facilities_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_facilityId_facilities_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_diffs" ADD CONSTRAINT "ingestion_diffs_ingestionRunId_ingestion_runs_id_fk" FOREIGN KEY ("ingestionRunId") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_ingestionRunId_ingestion_runs_id_fk" FOREIGN KEY ("ingestionRunId") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_facilityId_facilities_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_professionalId_professionals_id_fk" FOREIGN KEY ("professionalId") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_facilityProfessionalId_facility_professionals_id_fk" FOREIGN KEY ("facilityProfessionalId") REFERENCES "public"."facility_professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_phoneNumber_idx" ON "invitations" USING btree ("phoneNumber");--> statement-breakpoint
CREATE INDEX "invitations_tokenHash_idx" ON "invitations" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_acceptedByUserId_idx" ON "invitations" USING btree ("acceptedByUserId");--> statement-breakpoint
CREATE INDEX "invitations_invitedByUserId_idx" ON "invitations" USING btree ("invitedByUserId");--> statement-breakpoint
CREATE INDEX "invitations_managerId_idx" ON "invitations" USING btree ("managerId");--> statement-breakpoint
CREATE INDEX "invitations_managerTerritoryId_idx" ON "invitations" USING btree ("managerTerritoryId");--> statement-breakpoint
CREATE INDEX "invitations_repTerritoryId_idx" ON "invitations" USING btree ("repTerritoryId");--> statement-breakpoint
CREATE INDEX "password_resets_userId_idx" ON "password_resets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "password_resets_tokenHash_idx" ON "password_resets" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "permissions_userId_idx" ON "permissions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "permissions_resource_resourceId_idx" ON "permissions" USING btree ("resource","resourceId");--> statement-breakpoint
CREATE INDEX "permissions_userId_resource_idx" ON "permissions" USING btree ("userId","resource");--> statement-breakpoint
CREATE INDEX "permissions_expiresAt_idx" ON "permissions" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_userId_resource_resourceId_action_uidx" ON "permissions" USING btree ("userId","resource","resourceId","action");--> statement-breakpoint
CREATE INDEX "roles_priority_idx" ON "roles" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions" USING btree ("refreshTokenHash");--> statement-breakpoint
CREATE INDEX "sessions_previousRefreshTokenHash_idx" ON "sessions" USING btree ("previousRefreshTokenHash");--> statement-breakpoint
CREATE INDEX "sessions_expiresAt_idx" ON "sessions" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "sessions_revokedAt_idx" ON "sessions" USING btree ("revokedAt");--> statement-breakpoint
CREATE INDEX "sessions_sessionType_idx" ON "sessions" USING btree ("sessionType");--> statement-breakpoint
CREATE INDEX "sessions_deviceFingerprint_idx" ON "sessions" USING btree ("deviceFingerprint");--> statement-breakpoint
CREATE INDEX "sessions_suspiciousActivity_idx" ON "sessions" USING btree ("suspiciousActivity");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_phoneNumber_idx" ON "users" USING btree ("phoneNumber");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_deletedAt_idx" ON "users" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "users_managerId_idx" ON "users" USING btree ("managerId");--> statement-breakpoint
CREATE INDEX "verification_tokens_userId_idx" ON "verification_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_tokens_tokenHash_idx" ON "verification_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "verification_tokens_type_idx" ON "verification_tokens" USING btree ("type");--> statement-breakpoint
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "territories_slug_uidx" ON "territories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "territories_parentId_idx" ON "territories" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "territories_managerTerritoryId_idx" ON "territories" USING btree ("managerTerritoryId");--> statement-breakpoint
CREATE INDEX "territories_isActive_idx" ON "territories" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "territories_nodeType_idx" ON "territories" USING btree ("nodeType");--> statement-breakpoint
CREATE INDEX "territories_countryCode_idx" ON "territories" USING btree ("countryCode");--> statement-breakpoint
CREATE INDEX "territories_territoryTypeId_idx" ON "territories" USING btree ("territoryTypeId");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_status_type_idx" ON "territory_approval_requests" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_requesterId_idx" ON "territory_approval_requests" USING btree ("requesterId");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_targetTerritoryId_status_idx" ON "territory_approval_requests" USING btree ("targetTerritoryId","status");--> statement-breakpoint
CREATE INDEX "territory_approval_requests_facilityId_status_type_idx" ON "territory_approval_requests" USING btree ("facilityId","status","type");--> statement-breakpoint
CREATE INDEX "territory_closure_descendantId_idx" ON "territory_closure" USING btree ("descendantId");--> statement-breakpoint
CREATE INDEX "territory_types_isActive_idx" ON "territory_types" USING btree ("isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "user_territory_assignments_userId_territoryId_uidx" ON "user_territory_assignments" USING btree ("userId","territoryId");--> statement-breakpoint
CREATE INDEX "user_territory_assignments_userId_idx" ON "user_territory_assignments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_territory_assignments_territoryId_idx" ON "user_territory_assignments" USING btree ("territoryId");--> statement-breakpoint
CREATE UNIQUE INDEX "conformity_records_facilityId_requirementId_uidx" ON "conformity_records" USING btree ("facility_id","requirement_id");--> statement-breakpoint
CREATE INDEX "conformity_records_facilityId_idx" ON "conformity_records" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "conformity_records_requirementId_idx" ON "conformity_records" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "conformity_records_status_idx" ON "conformity_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conformity_requirements_sectorId_idx" ON "conformity_requirements" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "conformity_requirements_isActive_idx" ON "conformity_requirements" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_sourceProvider_externalSourceId_uidx" ON "facilities" USING btree ("sourceProvider","externalSourceId");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_sourceProvider_cnesCode_uidx" ON "facilities" USING btree ("sourceProvider","cnes_code");--> statement-breakpoint
CREATE INDEX "facilities_territoryId_idx" ON "facilities" USING btree ("territoryId");--> statement-breakpoint
CREATE INDEX "facilities_deletedAt_idx" ON "facilities" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "facilities_displayName_idx" ON "facilities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "facilities_sourceProvider_sourcePresent_idx" ON "facilities" USING btree ("sourceProvider","sourcePresent");--> statement-breakpoint
CREATE INDEX "facilities_territoryAssignmentStatus_idx" ON "facilities" USING btree ("territoryAssignmentStatus");--> statement-breakpoint
CREATE INDEX "facilities_primarySectorId_idx" ON "facilities" USING btree ("primary_sector_id");--> statement-breakpoint
CREATE INDEX "facilities_conformityStatus_idx" ON "facilities" USING btree ("conformityStatus");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_facilityId_idx" ON "facility_consultant_assignments" USING btree ("facilityId");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_userId_idx" ON "facility_consultant_assignments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_facilityId_endedAt_idx" ON "facility_consultant_assignments" USING btree ("facilityId","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_healthcare_provider_shares_facilityId_providerId_uidx" ON "facility_healthcare_provider_shares" USING btree ("facility_id","healthcare_provider_id");--> statement-breakpoint
CREATE INDEX "facility_healthcare_provider_shares_facilityId_idx" ON "facility_healthcare_provider_shares" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_healthcare_provider_shares_healthcareProviderId_idx" ON "facility_healthcare_provider_shares" USING btree ("healthcare_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_professionals_facilityId_professionalId_occupationCode_uidx" ON "facility_professionals" USING btree ("facilityId","professionalId","occupation_code");--> statement-breakpoint
CREATE INDEX "facility_professionals_professionalId_idx" ON "facility_professionals" USING btree ("professionalId");--> statement-breakpoint
CREATE INDEX "facility_professionals_facilityId_idx" ON "facility_professionals" USING btree ("facilityId");--> statement-breakpoint
CREATE INDEX "facility_professionals_facilityId_sourceActive_endedAt_idx" ON "facility_professionals" USING btree ("facilityId","sourceActive","endedAt");--> statement-breakpoint
CREATE INDEX "facility_professionals_facilityId_confirmedAt_endedAt_idx" ON "facility_professionals" USING btree ("facilityId","confirmedAt","endedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_representatives_facilityId_externalSourceKey_uidx" ON "facility_representatives" USING btree ("facilityId","external_source_key");--> statement-breakpoint
CREATE INDEX "facility_representatives_facilityId_idx" ON "facility_representatives" USING btree ("facilityId");--> statement-breakpoint
CREATE INDEX "facility_representatives_facilityId_sourceActive_endedAt_idx" ON "facility_representatives" USING btree ("facilityId","source_active","ended_at");--> statement-breakpoint
CREATE INDEX "healthcare_providers_isActive_idx" ON "healthcare_providers" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_sourceProvider_externalSourceId_uidx" ON "professionals" USING btree ("sourceProvider","externalSourceId");--> statement-breakpoint
CREATE INDEX "professionals_deletedAt_idx" ON "professionals" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "professionals_lastName_firstName_idx" ON "professionals" USING btree ("lastName","firstName");--> statement-breakpoint
CREATE INDEX "professionals_sourceProvider_sourcePresent_idx" ON "professionals" USING btree ("sourceProvider","sourcePresent");--> statement-breakpoint
CREATE INDEX "professionals_taxId_idx" ON "professionals" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "sectors_isActive_idx" ON "sectors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "products_sectorId_idx" ON "products" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "products_isActive_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ingestion_diffs_ingestionRunId_idx" ON "ingestion_diffs" USING btree ("ingestionRunId");--> statement-breakpoint
CREATE INDEX "ingestion_diffs_scope_entityType_idx" ON "ingestion_diffs" USING btree ("scope","entityType");--> statement-breakpoint
CREATE INDEX "ingestion_runs_sourceProvider_startedAt_idx" ON "ingestion_runs" USING btree ("sourceProvider","startedAt");--> statement-breakpoint
CREATE INDEX "ingestion_runs_status_idx" ON "ingestion_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingestion_runs_temporalWorkflowId_idx" ON "ingestion_runs" USING btree ("temporalWorkflowId");--> statement-breakpoint
CREATE INDEX "ingestion_suggestions_status_type_idx" ON "ingestion_suggestions" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "ingestion_suggestions_facilityId_status_idx" ON "ingestion_suggestions" USING btree ("facilityId","status");--> statement-breakpoint
CREATE INDEX "ingestion_suggestions_ingestionRunId_idx" ON "ingestion_suggestions" USING btree ("ingestionRunId");--> statement-breakpoint
CREATE INDEX "audit_logs_userId_idx" ON "audit"."audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_logs_eventType_idx" ON "audit"."audit_logs" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "audit_logs_severity_idx" ON "audit"."audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "audit_logs_createdAt_idx" ON "audit"."audit_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "audit_logs_actorId_idx" ON "audit"."audit_logs" USING btree ("actorId");--> statement-breakpoint
CREATE INDEX "audit_logs_resourceId_idx" ON "audit"."audit_logs" USING btree ("resourceId");--> statement-breakpoint
CREATE INDEX "audit_logs_sessionId_idx" ON "audit"."audit_logs" USING btree ("sessionId");