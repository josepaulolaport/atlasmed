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
  territoryNodeTypeEnum,
  territoryAssignmentStatusEnum,
  territoryAssignmentSourceEnum,
  territoryApprovalTypeEnum,
  territoryApprovalStatusEnum,
  relationshipLevelEnum,
  conformityStatusEnum,
  conformityRecordStatusEnum,
  purchaseStatusEnum,
  authSessionDeviceTypeEnum,
  authSessionTypeEnum,
  verificationTokenTypeEnum,
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
export type TerritoryNodeType = (typeof territoryNodeTypeEnum.enumValues)[number];
export type TerritoryAssignmentStatus = (typeof territoryAssignmentStatusEnum.enumValues)[number];
export type TerritoryAssignmentSource = (typeof territoryAssignmentSourceEnum.enumValues)[number];
export type TerritoryApprovalType = (typeof territoryApprovalTypeEnum.enumValues)[number];
export type TerritoryApprovalStatus = (typeof territoryApprovalStatusEnum.enumValues)[number];
export type RelationshipLevel = (typeof relationshipLevelEnum.enumValues)[number];
export type ConformityStatus = (typeof conformityStatusEnum.enumValues)[number];
export type ConformityRecordStatus = (typeof conformityRecordStatusEnum.enumValues)[number];
export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type AuthSessionDeviceType = (typeof authSessionDeviceTypeEnum.enumValues)[number];
export type AuthSessionType = (typeof authSessionTypeEnum.enumValues)[number];
export type VerificationTokenType = (typeof verificationTokenTypeEnum.enumValues)[number];
