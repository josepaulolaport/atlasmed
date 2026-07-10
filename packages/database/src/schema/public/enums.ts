import { pgEnum } from "drizzle-orm/pg-core";

export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
]);

export const userStatusEnum = pgEnum("user_status", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING",
]);

export const authSessionDeviceTypeEnum = pgEnum("auth_session_device_type", [
  "DESKTOP",
  "MOBILE",
  "TABLET",
  "UNKNOWN",
]);

export const authSessionTypeEnum = pgEnum("auth_session_type", [
  "WEB",
  "MOBILE",
  "API",
]);

export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const ingestionRunPhaseEnum = pgEnum("ingestion_run_phase", [
  "DISCOVERING",
  "DOWNLOADING",
  "EXTRACTING",
  "PREFLIGHT",
  "PARSING",
  "LOADING",
  "VALIDATING",
  "RECONCILING",
  "PROMOTING",
  "SYNCING",
  "FAILED",
]);

export const ingestionDiffScopeEnum = pgEnum("ingestion_diff_scope", [
  "WAREHOUSE",
  "CRM",
]);

export const ingestionSuggestionTypeEnum = pgEnum("ingestion_suggestion_type", [
  "FACILITY_FIELD_UPDATE",
  "PROFESSIONAL_FIELD_UPDATE",
  "FACILITY_REGISTRY_DEACTIVATED",
  "FACILITY_REGISTRY_REACTIVATED",
  "FACILITY_PROFESSIONAL_REMOVAL",
  "FACILITY_PROFESSIONAL_ADD",
  "FACILITY_REPRESENTATIVE_REMOVAL",
  "FACILITY_REPRESENTATIVE_ADD",
  "FACILITY_REPRESENTATIVE_FIELD_UPDATE",
  "CLINIC_REMOVAL",
  "CLINIC_REACTIVATION",
  "DOCTOR_CLINIC_REMOVAL",
]);

export const ingestionSuggestionStatusEnum = pgEnum("ingestion_suggestion_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
]);

export const conformityStatusEnum = pgEnum("conformity_status", [
  "INCOMPLETE",
  "COMPLETE",
  "EXPIRING_SOON",
  "NON_CONFORMING",
]);

export const conformityRecordStatusEnum = pgEnum("conformity_record_status", [
  "PENDING",
  "SUBMITTED",
  "VALIDATED",
  "REJECTED",
  "EXPIRED",
]);

export const commercialStatusEnum = pgEnum("commercial_status", [
  "REGISTERED",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "NON_BUYER",
  "LOW_BUYER",
  "REGULAR_BUYER",
  "HIGH_BUYER",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "PROFESSIONAL",
  "DECISOR",
  "COMPRADOR",
]);

export const relationshipLevelEnum = pgEnum("relationship_level", [
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const healthcareProviderTypeEnum = pgEnum("healthcare_provider_type", [
  "PRIVATE",
  "PUBLIC",
  "MIXED",
  "OTHER",
]);

export const healthcareProviderShareSourceEnum = pgEnum("healthcare_provider_share_source", [
  "MANUAL",
  "REGISTRY",
  "IMPORT",
]);

export const verificationTokenTypeEnum = pgEnum("verification_token_type", [
  "EMAIL_VERIFICATION",
  "PHONE_VERIFICATION",
  "EMAIL_CHANGE",
  "PHONE_CHANGE",
]);

export const territoryNodeTypeEnum = pgEnum("territory_node_type", [
  "root",
  "region",
  "state",
  "intermediate",
  "patch",
]);

export const territoryAssignmentStatusEnum = pgEnum("territory_assignment_status", [
  "assigned",
  "unassigned",
  "ambiguous",
]);

export const territoryAssignmentSourceEnum = pgEnum("territory_assignment_source", [
  "geo",
  "manual",
]);

export const territoryApprovalTypeEnum = pgEnum("territory_approval_type", [
  "create_territory",
  "reparent_territory",
  "deactivate_territory",
  "clinic_territory_change",
]);

export const territoryApprovalStatusEnum = pgEnum("territory_approval_status", [
  "pending",
  "approved",
  "rejected",
  "superseded",
]);
