// Re-export database enums as single source of truth
export type {
  AuthSessionDeviceType as DeviceType,
  AuthSessionType as SessionType,
  InvitationStatus as InviteStatus,
  RelationshipLevel,
  UserStatus
} from '@atlasmed/database'
export * from './constants/auth.constants'
export * from './constants/cookie.constants'
export type { AccessGrantRecord } from './contracts/access-grant.contract'
export {
  GRANT_RESOURCE_TO_SUBJECT,
  grantActionToCaslAction,
  LEGACY_GRANT_RESOURCE_ALIASES,
  normalizeGrantResource
} from './contracts/access-grant.contract'
export * from './contracts/access-token.contract'
export * from './contracts/auth-context.contract'
export * from './contracts/invite.contract'
export * from './contracts/role.contract'
export * from './contracts/scope-context.contract'
export * from './contracts/session.contract'
export * from './contracts/user.contract'
// Application-level role enum (not a Prisma enum)
export * from './enums/role.enum'
export * from './errors/forbidden.error'
export * from './errors/http.error'
export * from './errors/invalid-credentials.error'
export * from './errors/invalid-invite.error'
export * from './errors/rate-limit.error'
export * from './errors/unauthorized.error'
export { defineAbilitiesForUser } from './permissions/grant.permissions'
export {
  buildCaslConditionsFromGrant,
  GrantConditionValidationError,
  validateGrantConditions
} from './permissions/grant-conditions'
export type { Action, AppAbility, Subject } from './permissions/role.permissions'
export { defineAbilitiesFor } from './permissions/role.permissions'
export {
  canAccessResource,
  canAccessRoute,
  isValidGrantAction,
  isValidGrantResource
} from './permissions/route.permissions'
export {
  canCreateTerritories,
  canManageCatalog,
  canManageFacilities,
  canManageProfessionals,
  canManageTerritories,
  canManageUsers,
  canReadCatalog,
  canReadFacilities,
  canReadProfessionals,
  canReadTerritories,
  canUpdateFacilities,
  canUpdateProfessionals,
  canUpdateTerritories,
  canViewHealth,
  hasMinimumRole,
  isAdmin
} from './permissions/ui.permissions'
export * from './schemas/accept-invite.schema'
export * from './schemas/change-password.schema'
export * from './schemas/change-user-role.schema'
export * from './schemas/facility.schema'
export * from './schemas/invite-user.schema'
export * from './schemas/list-users.schema'
export * from './schemas/login.schema'
export * from './schemas/professional.schema'
export * from './schemas/refresh-token.schema'
export * from './schemas/registry.schema'
export * from './schemas/territory.schema'
export * from './schemas/update-profile.schema'
export * from './schemas/user-assignment.schema'
export * from './schemas/user-permission.schema'
export * from './schemas/user-preferences.schema'
export {
  canChangeUserRole,
  canMutateUser,
  createEmptyScopeContext,
  createGlobalScopeContext
} from './scope/scope.helpers'
export type { ScopedResourceType } from './scope/scope-enforcement.helpers'
export { assertResourceInScope } from './scope/scope-enforcement.helpers'
export { mergeGrantsIntoScope } from './scope/scope-grant.helpers'
export {
  assertScopedFacility,
  assertScopedTerritory,
  assertScopedUser
} from './scope/scope-guard'
export * from './subjects/subjects'
export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENT_MESSAGES,
  validatePassword
} from './utils/password-validator'
