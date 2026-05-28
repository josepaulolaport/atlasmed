export * from "./contracts/access-token.contract";
export * from "./contracts/auth-context.contract";
export * from "./contracts/invite.contract";
export * from "./contracts/role.contract";
export * from "./contracts/session.contract";
export * from "./contracts/user.contract";
export * from "./contracts/scope-context.contract";

export * from "./schemas/accept-invite.schema";
export * from "./schemas/invite-user.schema";
export * from "./schemas/change-user-role.schema";
export * from "./schemas/login.schema";
export * from "./schemas/refresh-token.schema";
export * from "./schemas/list-users.schema";
export * from "./schemas/update-profile.schema";
export * from "./schemas/change-password.schema";
export * from "./schemas/user-assignment.schema";
export * from "./schemas/user-permission.schema";
export * from "./schemas/clinic.schema";
export * from "./schemas/doctor.schema";

// Re-export Prisma enums as single source of truth
export {
  UserStatus,
  InvitationStatus as InviteStatus,
  AuthSessionDeviceType as DeviceType,
  AuthSessionType as SessionType,
} from "@atlasmed/database";

// Application-level role enum (not a Prisma enum)
export * from "./enums/role.enum";

export * from "./constants/auth.constants";
export * from "./constants/cookie.constants";

export * from "./errors/http.error";
export * from "./errors/forbidden.error";
export * from "./errors/invalid-credentials.error";
export * from "./errors/invalid-invite.error";
export * from "./errors/unauthorized.error";
export * from "./errors/rate-limit.error";

export { defineAbilitiesFor } from "./permissions/role.permissions";
export type { Action, AppAbility, Subject } from "./permissions/role.permissions";
export { defineAbilitiesForUser } from "./permissions/grant.permissions";
export {
  canAccessRoute,
  canAccessResource,
  isValidGrantResource,
  isValidGrantAction,
} from "./permissions/route.permissions";
export type { AccessGrantRecord } from "./contracts/access-grant.contract";
export {
  GRANT_RESOURCE_TO_SUBJECT,
  grantActionToCaslAction,
} from "./contracts/access-grant.contract";
export {
  canManageUsers,
  canReadClinics,
  canManageClinics,
  canReadDoctors,
  canManageDoctors,
  canViewHealth,
  hasMinimumRole,
  isAdmin,
} from "./permissions/ui.permissions";

export * from "./subjects/subjects";

export {
  createGlobalScopeContext,
  createEmptyScopeContext,
  canMutateUser,
  canChangeUserRole,
} from "./scope/scope.helpers";
export { mergeGrantsIntoScope } from "./scope/scope-grant.helpers";
export { assertResourceInScope } from "./scope/scope-enforcement.helpers";
export type { ScopedResourceType } from "./scope/scope-enforcement.helpers";
export {
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENT_MESSAGES,
} from "./utils/password-validator";
