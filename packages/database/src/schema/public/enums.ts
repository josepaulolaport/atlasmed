import { pgEnum } from "drizzle-orm/pg-core";

export const invitationStatusEnum = pgEnum("InvitationStatus", [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
]);

export const userStatusEnum = pgEnum("UserStatus", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING",
]);

export const authSessionDeviceTypeEnum = pgEnum("AuthSessionDeviceType", [
  "DESKTOP",
  "MOBILE",
  "TABLET",
  "UNKNOWN",
]);

export const authSessionTypeEnum = pgEnum("AuthSessionType", [
  "WEB",
  "MOBILE",
  "API",
]);

export const auditEventTypeEnum = pgEnum("AuditEventType", [
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_REGISTER",
  "USER_INVITE",
  "USER_ACCEPT_INVITE",
  "USER_DEACTIVATE",
  "USER_ACTIVATE",
  "USER_SUSPEND",
  "USER_UNSUSPEND",
  "USER_MANAGER_ASSIGNED",
  "USER_MANAGER_REMOVED",
  "USER_TERRITORY_ASSIGNED",
  "USER_TERRITORY_REVOKED",
  "PASSWORD_CHANGE",
  "PASSWORD_RESET_REQUEST",
  "PASSWORD_RESET_COMPLETE",
  "EMAIL_CHANGE",
  "PHONE_CHANGE",
  "EMAIL_VERIFY",
  "PHONE_VERIFY",
  "ROLE_CHANGE",
  "SESSION_CREATE",
  "SESSION_REVOKE",
  "PERMISSION_GRANT",
  "PERMISSION_REVOKE",
  "TWO_FACTOR_ENABLE",
  "TWO_FACTOR_DISABLE",
  "SUSPICIOUS_ACTIVITY",
  "DATA_ACCESS",
  "DATA_EXPORT",
  "REGISTRY_INGESTION_STARTED",
  "REGISTRY_INGESTION_COMPLETED",
  "REGISTRY_SUGGESTION_APPROVED",
  "REGISTRY_SUGGESTION_REJECTED",
  "DOCTOR_CLINIC_CONFIRMED",
  "DOCTOR_CLINIC_ASSOCIATION_ENDED",
  "DOCTOR_CLINIC_MANUAL_ASSOCIATED",
  "CLINIC_REACTIVATED",
]);

export const auditEventSeverityEnum = pgEnum("AuditEventSeverity", [
  "INFO",
  "WARNING",
  "CRITICAL",
]);

export const ingestionRunStatusEnum = pgEnum("IngestionRunStatus", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const ingestionRunPhaseEnum = pgEnum("IngestionRunPhase", [
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

export const ingestionDiffScopeEnum = pgEnum("IngestionDiffScope", [
  "WAREHOUSE",
  "CRM",
]);

export const ingestionSuggestionTypeEnum = pgEnum("IngestionSuggestionType", [
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

export const ingestionSuggestionStatusEnum = pgEnum("IngestionSuggestionStatus", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
]);

export const conformityStatusEnum = pgEnum("ConformityStatus", [
  "INCOMPLETE",
  "COMPLETE",
  "EXPIRING_SOON",
  "NON_CONFORMING",
]);

export const conformityRecordStatusEnum = pgEnum("ConformityRecordStatus", [
  "PENDING",
  "SUBMITTED",
  "VALIDATED",
  "REJECTED",
  "EXPIRED",
]);

export const commercialStatusEnum = pgEnum("CommercialStatus", [
  "REGISTERED",
  "COMMERCIALLY_ACTIVE",
  "COMMERCIALLY_SUSPENDED",
  "COMMERCIALLY_INACTIVE",
]);

export const purchaseStatusEnum = pgEnum("PurchaseStatus", [
  "NAO_COMPRA",
  "COMPRA",
  "COMPRA_POUCO",
  "COMPRA_MUITO",
]);

export const contactTypeEnum = pgEnum("ContactType", [
  "PROFESSIONAL",
  "DECISOR",
  "COMPRADOR",
]);

export const relationshipLevelEnum = pgEnum("RelationshipLevel", [
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const healthcareProviderTypeEnum = pgEnum("HealthcareProviderType", [
  "PRIVATE",
  "PUBLIC",
  "MIXED",
  "OTHER",
]);

export const healthcareProviderShareSourceEnum = pgEnum("HealthcareProviderShareSource", [
  "MANUAL",
  "REGISTRY",
  "IMPORT",
]);

export const verificationTokenTypeEnum = pgEnum("VerificationTokenType", [
  "EMAIL_VERIFICATION",
  "PHONE_VERIFICATION",
  "EMAIL_CHANGE",
  "PHONE_CHANGE",
]);

export const territoryNodeTypeEnum = pgEnum("TerritoryNodeType", [
  "root",
  "region",
  "state",
  "intermediate",
  "patch",
]);

export const territoryAssignmentStatusEnum = pgEnum("TerritoryAssignmentStatus", [
  "assigned",
  "unassigned",
  "ambiguous",
]);

export const territoryAssignmentSourceEnum = pgEnum("TerritoryAssignmentSource", [
  "geo",
  "manual",
]);

export const territoryApprovalTypeEnum = pgEnum("TerritoryApprovalType", [
  "create_territory",
  "reparent_territory",
  "deactivate_territory",
  "clinic_territory_change",
]);

export const territoryApprovalStatusEnum = pgEnum("TerritoryApprovalStatus", [
  "pending",
  "approved",
  "rejected",
  "superseded",
]);
