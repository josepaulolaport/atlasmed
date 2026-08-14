import {
  PURCHASE_FUNNEL_STAGES,
  PURCHASE_INTERVAL_SOURCES,
  PURCHASE_PROFILES,
} from "@atlasmed/facility-insights";
import { pgEnum } from "drizzle-orm/pg-core";

export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
]);

/**
 * How a `facility_emultec_clients` row came to exist. `MANUAL` is an operator
 * decision; the `AUTO_*` values record which document the importer matched on.
 */
export const emultecClientLinkSourceEnum = pgEnum("emultec_client_link_source", [
  "MANUAL",
  "AUTO_CNPJ",
  "AUTO_CPF",
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


/**
 * Cadastro document completion, per facility × vertical profile.
 *
 * Named `conformity_status` since spec 0010 §1.6, and `commercial_status`
 * before that — the values were always cadastro state, never commercial state.
 * `UNREGISTERED` = never completed, `REGISTERED` = complete, `SUSPENDED` =
 * regressed after having been complete. `CLOSED` is unreachable; nothing writes
 * it.
 *
 * The facility-wide `conformity_status` that previously owned this name
 * (INCOMPLETE / COMPLETE / EXPIRING_SOON / NON_CONFORMING) was dropped in the
 * same migration: one verdict across verticals that require different documents
 * cannot mean anything. Spec 0011 §3.3 wants EXPIRING_SOON back when document
 * expiry ships — that is an ALTER TYPE ADD VALUE at the time, not a reason to
 * carry an unwritable value now (D-66).
 */
export const conformityStatusEnum = pgEnum("conformity_status", [
  "UNREGISTERED",
  "REGISTERED",
  "SUSPENDED",
  "CLOSED",
]);

export const conformityRecordStatusEnum = pgEnum("conformity_record_status", [
  "PENDING",
  "SUBMITTED",
  "VALIDATED",
  "REJECTED",
  "EXPIRED",
]);

export const purchaseIntervalSourceEnum = pgEnum(
  "purchase_interval_source",
  PURCHASE_INTERVAL_SOURCES,
);

export const purchaseProfileEnum = pgEnum("purchase_profile", PURCHASE_PROFILES);

export const purchaseFunnelStageEnum = pgEnum(
  "purchase_funnel_stage",
  PURCHASE_FUNNEL_STAGES,
);

/** User×person relationship strength on a 1–10 scale. */
export const RELATIONSHIP_LEVEL_MIN = 1;
export const RELATIONSHIP_LEVEL_MAX = 10;

export const healthcareProviderTypeEnum = pgEnum("healthcare_provider_type", [
  "PRIVATE",
  "PUBLIC",
  "MIXED",
  "OTHER",
]);

export const verificationTokenTypeEnum = pgEnum("verification_token_type", [
  "EMAIL_VERIFICATION",
  "PHONE_VERIFICATION",
  "EMAIL_CHANGE",
  "PHONE_CHANGE",
]);

/**
 * Document kind for a facility's legal identifier.
 * CNPJ = company (14 digits). CPF = individual practitioner (11 digits).
 */
export const facilityLegalDocumentTypeEnum = pgEnum("facility_legal_document_type", [
  "CNPJ",
  "CPF",
]);

/**
 * Whether a catalogued product is ours or a competitor's (spec 0013 §2).
 * An enum rather than a boolean because a distributed third-party line is
 * neither, and will want its own value rather than a second boolean.
 */
export const productOwnershipEnum = pgEnum("product_ownership", [
  "OWN",
  "COMPETITOR",
]);

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

/**
 * Cadastro document lifecycle. The document is the unit — there is no package
 * status above it (ADR 0007).
 */
export const cadastroDocumentStatusEnum = pgEnum("cadastro_document_status", [
  "DRAFT",
  "PROCESSING",
  "READY",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
]);

/** Physical file asset in object storage. */
export const cadastroFileAssetStatusEnum = pgEnum("cadastro_file_asset_status", [
  "PENDING_UPLOAD",
  "UPLOADING",
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
]);

/** Role of a file within a logical document. */
export const cadastroDocumentFileRoleEnum = pgEnum("cadastro_document_file_role", [
  "FRONT",
  "BACK",
  "PAGE",
  "ATTACHMENT",
  "SUPPORTING_DOCUMENT",
]);

export const cadastroUploadSessionStatusEnum = pgEnum("cadastro_upload_session_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "ABORTED",
  "EXPIRED",
]);

export const cadastroReviewDecisionEnum = pgEnum("cadastro_review_decision", [
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
]);

export const cadastroProcessingStepStatusEnum = pgEnum(
  "cadastro_processing_step_status",
  ["STARTED", "SUCCEEDED", "FAILED"]
);

/** User-submitted Não Conformidades (field suggestions) — not CNES registry. */
export const fieldSuggestionKindEnum = pgEnum("field_suggestion_kind", [
  "FIELD_CHANGE",
  "DEACTIVATION",
]);

export const fieldSuggestionStatusEnum = pgEnum("field_suggestion_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
