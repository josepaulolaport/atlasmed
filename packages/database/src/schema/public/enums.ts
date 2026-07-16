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

/** Relationship strength on a 1–10 scale (validated in DB + application). */
export const RELATIONSHIP_LEVEL_MIN = 1;
export const RELATIONSHIP_LEVEL_MAX = 10;

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

/**
 * Legal entity type for a facility's tax registration.
 * PJ = Pessoa Jurídica (company, identified by CNPJ).
 * PF = Pessoa Física (individual practitioner, identified by CPF).
 */
export const facilityTaxIdTypeEnum = pgEnum("facility_tax_id_type", ["PJ", "PF"]);

export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "INVOICED",
  "REJECTED",
  "NO_BILLING",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "SALE",
  "CONSIGNMENT",
  "DONATION",
  "OTHER",
]);

export const interactionTypeEnum = pgEnum("interaction_type", [
  "followup",
  "presentation",
]);
