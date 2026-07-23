export { createDatabase, type Database, type AnyDatabase, type DatabaseTransaction } from "./client";

export * from "./schema/public/index";
export * from "./schema/audit/index";
export * from "./schema/registry/index";
export * from "./schema/ingestion/index";
export * from "./types/geometry";

// Explicit enum value types for backward-compat
import {
  auditEventSeverityEnum,
} from "./schema/audit/index";
import {
  userStatusEnum,
  invitationStatusEnum,
  territoryAssignmentStatusEnum,
  territoryAssignmentSourceEnum,
  territoryApprovalTypeEnum,
  territoryApprovalStatusEnum,
  RELATIONSHIP_LEVEL_MIN,
  RELATIONSHIP_LEVEL_MAX,
  conformityStatusEnum,
  conformityRecordStatusEnum,
  purchaseStatusEnum,
  authSessionDeviceTypeEnum,
  authSessionTypeEnum,
  verificationTokenTypeEnum,
  facilityTaxIdTypeEnum,
  orderStatusEnum,
  orderTypeEnum,
  fieldSuggestionKindEnum,
  fieldSuggestionStatusEnum,
} from "./schema/public/enums";
import {
  cnesRunStatusEnum,
  cnesRunPhaseEnum,
  cnesSuggestionTypeEnum,
  cnesSuggestionStatusEnum,
} from "./schema/ingestion/index";

export type AuditEventSeverity = (typeof auditEventSeverityEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];
export type CnesRunStatus = (typeof cnesRunStatusEnum.enumValues)[number];
export type CnesRunPhase = (typeof cnesRunPhaseEnum.enumValues)[number];
export type CnesSuggestionType = (typeof cnesSuggestionTypeEnum.enumValues)[number];
export type CnesSuggestionStatus = (typeof cnesSuggestionStatusEnum.enumValues)[number];
export type TerritoryAssignmentStatus = (typeof territoryAssignmentStatusEnum.enumValues)[number];
export type TerritoryAssignmentSource = (typeof territoryAssignmentSourceEnum.enumValues)[number];
export type TerritoryApprovalType = (typeof territoryApprovalTypeEnum.enumValues)[number];
export type TerritoryApprovalStatus = (typeof territoryApprovalStatusEnum.enumValues)[number];
/** Integer 1–10 relationship strength between a user and a CRM professional. */
export type RelationshipLevel = number;
export { RELATIONSHIP_LEVEL_MIN, RELATIONSHIP_LEVEL_MAX };
export type ConformityStatus = (typeof conformityStatusEnum.enumValues)[number];
export type ConformityRecordStatus = (typeof conformityRecordStatusEnum.enumValues)[number];
export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type AuthSessionDeviceType = (typeof authSessionDeviceTypeEnum.enumValues)[number];
export type AuthSessionType = (typeof authSessionTypeEnum.enumValues)[number];
export type VerificationTokenType = (typeof verificationTokenTypeEnum.enumValues)[number];
export type FacilityTaxIdType = (typeof facilityTaxIdTypeEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type FieldSuggestionKind = (typeof fieldSuggestionKindEnum.enumValues)[number];
export type FieldSuggestionStatus =
  (typeof fieldSuggestionStatusEnum.enumValues)[number];
