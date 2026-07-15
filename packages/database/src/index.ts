export { type AnyDatabase, createDatabase, type Database, type DatabaseTransaction } from './client'
export * from './schema/audit/index'
export * from './schema/ingestion/index'
export * from './schema/public/index'
export * from './schema/registry/index'
export * from './types/geometry'

// Explicit enum value types for backward-compat
import type { auditEventSeverityEnum } from './schema/audit/index'
import type {
  cnesRunPhaseEnum,
  cnesRunStatusEnum,
  cnesSuggestionStatusEnum,
  cnesSuggestionTypeEnum
} from './schema/ingestion/index'
import {
  type authSessionDeviceTypeEnum,
  type authSessionTypeEnum,
  type conformityRecordStatusEnum,
  type conformityStatusEnum,
  type facilityTaxIdTypeEnum,
  type invitationStatusEnum,
  type orderStatusEnum,
  type orderTypeEnum,
  type purchaseStatusEnum,
  RELATIONSHIP_LEVEL_MAX,
  RELATIONSHIP_LEVEL_MIN,
  type territoryApprovalStatusEnum,
  type territoryApprovalTypeEnum,
  type territoryAssignmentSourceEnum,
  type territoryAssignmentStatusEnum,
  type territoryNodeTypeEnum,
  type userStatusEnum,
  type verificationTokenTypeEnum
} from './schema/public/enums'

export type AuditEventSeverity = (typeof auditEventSeverityEnum.enumValues)[number]
export type UserStatus = (typeof userStatusEnum.enumValues)[number]
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number]
export type CnesRunStatus = (typeof cnesRunStatusEnum.enumValues)[number]
export type CnesRunPhase = (typeof cnesRunPhaseEnum.enumValues)[number]
export type CnesSuggestionType = (typeof cnesSuggestionTypeEnum.enumValues)[number]
export type CnesSuggestionStatus = (typeof cnesSuggestionStatusEnum.enumValues)[number]
export type TerritoryNodeType = (typeof territoryNodeTypeEnum.enumValues)[number]
export type TerritoryAssignmentStatus = (typeof territoryAssignmentStatusEnum.enumValues)[number]
export type TerritoryAssignmentSource = (typeof territoryAssignmentSourceEnum.enumValues)[number]
export type TerritoryApprovalType = (typeof territoryApprovalTypeEnum.enumValues)[number]
export type TerritoryApprovalStatus = (typeof territoryApprovalStatusEnum.enumValues)[number]
/** Integer 1–10 relationship strength between rep and facility contact. */
export type RelationshipLevel = number
export { RELATIONSHIP_LEVEL_MAX, RELATIONSHIP_LEVEL_MIN }
export type ConformityStatus = (typeof conformityStatusEnum.enumValues)[number]
export type ConformityRecordStatus = (typeof conformityRecordStatusEnum.enumValues)[number]
export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number]
export type AuthSessionDeviceType = (typeof authSessionDeviceTypeEnum.enumValues)[number]
export type AuthSessionType = (typeof authSessionTypeEnum.enumValues)[number]
export type VerificationTokenType = (typeof verificationTokenTypeEnum.enumValues)[number]
export type FacilityTaxIdType = (typeof facilityTaxIdTypeEnum.enumValues)[number]
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number]
export type OrderType = (typeof orderTypeEnum.enumValues)[number]
