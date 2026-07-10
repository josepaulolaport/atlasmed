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
