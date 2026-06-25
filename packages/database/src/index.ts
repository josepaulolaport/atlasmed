// Export Prisma types and client - client can be instantiated in apps/api/infrastructure
export type {
  User,
  Role,
  Session,
  Invitation,
  PasswordReset,
  AuditLog,
  Prisma,
} from "./generated/prisma";

// Export PrismaClient as both type and value
export { PrismaClient } from "./generated/prisma";

// Export enums that frontend/mobile might need
export { 
  UserStatus, 
  InvitationStatus, 
  AuthSessionDeviceType, 
  AuthSessionType,
  AuditEventType,
  AuditEventSeverity,
  VerificationTokenType,
  IngestionRunStatus,
  IngestionSuggestionType,
  IngestionSuggestionStatus,
  TerritoryNodeType,
  TerritoryAssignmentStatus,
  TerritoryAssignmentSource,
  TerritoryApprovalType,
  TerritoryApprovalStatus,
  TerritoryRollupRelationshipType,
  TerritoryRollupLinkSource,
  TerritoryParentAssignmentStatus,
  TerritoryParentAssignmentSource,
} from "./generated/prisma";

