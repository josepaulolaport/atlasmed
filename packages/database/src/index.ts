export { createDatabase, type Database, type AnyDatabase, type DatabaseTransaction } from "./client";
export {
  countQueries,
  summarizeQueries,
  withQueryCount,
  type QueryRecord,
} from "./query-counter";

export * from "./schema/public/index";
export * from "./schema/audit/index";
export * from "./schema/ops/index";
export * from "./schema/registry/index";
export * from "./schema/ingestion/index";
export * from "./types/geometry";
export {
  createMetricSnapshotStore,
  listAllProfileIds,
  listTheirsStanding,
  listProfilesWithChangedInputs,
  sumOursByProduct,
} from "./queries/metric-snapshot-store";

// Explicit enum value types for backward-compat
import {
  auditEventSeverityEnum,
} from "./schema/audit/index";
import {
  userStatusEnum,
  invitationStatusEnum,
  RELATIONSHIP_LEVEL_MIN,
  RELATIONSHIP_LEVEL_MAX,
  conformityStatusEnum,
  conformityRecordStatusEnum,
  purchaseIntervalSourceEnum,
  purchaseProfileEnum,
  purchaseFunnelStageEnum,
  authSessionDeviceTypeEnum,
  authSessionTypeEnum,
  verificationTokenTypeEnum,
  facilityLegalDocumentTypeEnum,
  orderStatusEnum,
  orderTypeEnum,
  cadastroDocumentStatusEnum,
  cadastroFileAssetStatusEnum,
  cadastroDocumentFileRoleEnum,
  cadastroUploadSessionStatusEnum,
  cadastroReviewDecisionEnum,
  cadastroProcessingStepStatusEnum,
  fieldSuggestionKindEnum,
  fieldSuggestionStatusEnum,
} from "./schema/public/enums";

export type AuditEventSeverity = (typeof auditEventSeverityEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];
/** Integer 1–10 relationship strength between a user and a CRM professional. */
export type RelationshipLevel = number;
export { RELATIONSHIP_LEVEL_MIN, RELATIONSHIP_LEVEL_MAX };
export type ConformityStatus = (typeof conformityStatusEnum.enumValues)[number];
export type ConformityRecordStatus = (typeof conformityRecordStatusEnum.enumValues)[number];
export type PurchaseIntervalSource = (typeof purchaseIntervalSourceEnum.enumValues)[number];
export type PurchaseProfile = (typeof purchaseProfileEnum.enumValues)[number];
export type PurchaseFunnelStage = (typeof purchaseFunnelStageEnum.enumValues)[number];
export type AuthSessionDeviceType = (typeof authSessionDeviceTypeEnum.enumValues)[number];
export type AuthSessionType = (typeof authSessionTypeEnum.enumValues)[number];
export type VerificationTokenType = (typeof verificationTokenTypeEnum.enumValues)[number];
export type FacilityLegalDocumentType =
  (typeof facilityLegalDocumentTypeEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type CadastroDocumentStatus =
  (typeof cadastroDocumentStatusEnum.enumValues)[number];
export type CadastroFileAssetStatus =
  (typeof cadastroFileAssetStatusEnum.enumValues)[number];
export type CadastroDocumentFileRole =
  (typeof cadastroDocumentFileRoleEnum.enumValues)[number];
export type CadastroUploadSessionStatus =
  (typeof cadastroUploadSessionStatusEnum.enumValues)[number];
export type CadastroReviewDecision =
  (typeof cadastroReviewDecisionEnum.enumValues)[number];
export type CadastroProcessingStepStatus =
  (typeof cadastroProcessingStepStatusEnum.enumValues)[number];
export type FieldSuggestionKind = (typeof fieldSuggestionKindEnum.enumValues)[number];
export type FieldSuggestionStatus =
  (typeof fieldSuggestionStatusEnum.enumValues)[number];
