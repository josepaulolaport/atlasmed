/**
 * Error System Entry Point
 * 
 * Exports all error classes for use throughout the application.
 */

export { AppError } from "./base-error";

export {
  // Authentication Errors
  InvalidCredentialsError,
  SessionExpiredError,
  TokenInvalidError,
  TokenExpiredError,
  UnauthorizedError,
  RefreshTokenReuseDetectedError,
  SessionSecurityViolationError,
  
  // Authorization Errors
  ForbiddenError,
  InsufficientPermissionsError,
  AccountSuspendedError,
  AccountDeactivatedError,
  AccountPendingError,
  AccountLockedError,
  
  // Resource Errors
  ResourceNotFoundError,
  UserNotFoundError,
  SessionNotFoundError,
  InviteNotFoundError,
  RoleNotFoundError,
  
  // Conflict Errors
  ResourceConflictError,
  EmailAlreadyExistsError,
  UsernameAlreadyExistsError,
  InviteAlreadyUsedError,
  
  // Gone Errors
  InviteExpiredError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
  
  // Validation Errors
  ValidationError,
  InvalidPasswordError,
  PasswordReuseError,
  InvalidEmailError,
  InvalidInviteError,
  
  // Rate Limiting Errors
  RateLimitExceededError,
  TooManyLoginAttemptsError,
  
  // Business Logic Errors
  InviteRevokedError,
  SessionRevokedError,
  OperationNotAllowedError,
  
  // Server Errors
  DatabaseError,
  ExternalServiceError,
  CacheError,
} from "./domain-errors";
