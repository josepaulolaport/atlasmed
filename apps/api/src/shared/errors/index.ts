/**
 * Error System Entry Point
 *
 * Exports all error classes for use throughout the application.
 */

export { AppError } from './base-error'

export {
  AccountDeactivatedError,
  AccountLockedError,
  AccountPendingError,
  AccountSuspendedError,
  CacheError,
  ConfigurationError,
  // Server Errors
  DatabaseError,
  EmailAlreadyExistsError,
  ExternalServiceError,
  // Authorization Errors
  ForbiddenError,
  InsufficientPermissionsError,
  // Authentication Errors
  InvalidCredentialsError,
  InvalidEmailError,
  InvalidInviteError,
  InvalidPasswordError,
  InviteAlreadyUsedError,
  // Gone Errors
  InviteExpiredError,
  InviteNotFoundError,
  // Business Logic Errors
  InviteRevokedError,
  OperationNotAllowedError,
  PasswordReuseError,
  // Rate Limiting Errors
  RateLimitExceededError,
  RefreshTokenReuseDetectedError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
  // Conflict Errors
  ResourceConflictError,
  // Resource Errors
  ResourceNotFoundError,
  RoleNotFoundError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionRevokedError,
  SessionSecurityViolationError,
  TokenExpiredError,
  TokenInvalidError,
  TooManyLoginAttemptsError,
  UnauthorizedError,
  UserNotFoundError,
  UsernameAlreadyExistsError,
  // Validation Errors
  ValidationError
} from './domain-errors'
