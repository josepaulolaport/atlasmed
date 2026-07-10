export { createDatabase, type Database } from "./client";

export * from "./schema/public/index";
export * from "./schema/registry/index";
export * from "./types/geometry";

// Explicit enum value types for backward-compat with callers that imported from @prisma/client
import {
  auditEventTypeEnum,
  auditEventSeverityEnum,
  userStatusEnum,
  invitationStatusEnum,
  ingestionRunStatusEnum,
  ingestionRunPhaseEnum,
  ingestionSuggestionTypeEnum,
  ingestionSuggestionStatusEnum,
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

export type AuditEventType = (typeof auditEventTypeEnum.enumValues)[number];
export type AuditEventSeverity = (typeof auditEventSeverityEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];
export type IngestionRunStatus = (typeof ingestionRunStatusEnum.enumValues)[number];
export type IngestionRunPhase = (typeof ingestionRunPhaseEnum.enumValues)[number];
export type IngestionSuggestionType = (typeof ingestionSuggestionTypeEnum.enumValues)[number];
export type IngestionSuggestionStatus = (typeof ingestionSuggestionStatusEnum.enumValues)[number];
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
