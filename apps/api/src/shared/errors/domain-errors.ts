/**
 * Domain-Specific Error Classes
 * 
 * All custom errors for the AtlasMed API.
 * Each error has a unique code and appropriate HTTP status code.
 */

import { AppError } from "./base-error";

// ============================================================================
// Authentication Errors (401)
// ============================================================================

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(
      'INVALID_CREDENTIALS',
      401,
      'Invalid email or password'
    );
  }
}

export class SessionExpiredError extends AppError {
  constructor() {
    super(
      'SESSION_EXPIRED',
      401,
      'Your session has expired. Please login again.'
    );
  }
}

export class TokenInvalidError extends AppError {
  constructor(reason?: string) {
    super(
      'TOKEN_INVALID',
      401,
      'Invalid or malformed authentication token',
      reason ? { reason } : undefined
    );
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(
      'TOKEN_EXPIRED',
      401,
      'Authentication token has expired'
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(
      'UNAUTHORIZED',
      401,
      message
    );
  }
}

export class RefreshTokenReuseDetectedError extends AppError {
  constructor(context?: { userId?: string; sessionId?: string }) {
    super(
      'REFRESH_TOKEN_REUSE_DETECTED',
      401,
      'Session invalidated due to suspicious refresh token activity. Please sign in again.',
      context
    );
  }
}

export class SessionSecurityViolationError extends AppError {
  constructor(reason?: string) {
    super(
      'SESSION_SECURITY_VIOLATION',
      401,
      'Session invalidated due to suspicious activity. Please sign in again.',
      reason ? { reason } : undefined
    );
  }
}

// ============================================================================
// Authorization Errors (403)
// ============================================================================

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(
      'FORBIDDEN',
      403,
      message
    );
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(required: string[], has: string[]) {
    super(
      'INSUFFICIENT_PERMISSIONS',
      403,
      'You do not have permission to perform this action',
      { required, has }
    );
  }
}

export class AccountSuspendedError extends AppError {
  constructor(reason?: string) {
    super(
      'ACCOUNT_SUSPENDED',
      403,
      'Your account has been suspended',
      reason ? { reason } : undefined
    );
  }
}

export class AccountDeactivatedError extends AppError {
  constructor() {
    super(
      'ACCOUNT_DEACTIVATED',
      403,
      'Your account has been deactivated. Please contact support.'
    );
  }
}

export class AccountPendingError extends AppError {
  constructor() {
    super(
      'ACCOUNT_PENDING',
      403,
      'Your account is pending activation. Please complete your registration.'
    );
  }
}

export class AccountLockedError extends AppError {
  constructor(unlockAt: Date) {
    super(
      'ACCOUNT_LOCKED',
      403,
      'Your account has been temporarily locked due to too many failed login attempts',
      { unlockAt: unlockAt.toISOString() }
    );
  }
}

// ============================================================================
// Resource Errors (404)
// ============================================================================

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, identifier: string | number) {
    super(
      'RESOURCE_NOT_FOUND',
      404,
      `${resource} not found`,
      { resource, identifier }
    );
  }
}

export class UserNotFoundError extends AppError {
  constructor(identifier: string) {
    super(
      'USER_NOT_FOUND',
      404,
      'User not found',
      { identifier }
    );
  }
}

export class SessionNotFoundError extends AppError {
  constructor(sessionId: string) {
    super(
      'SESSION_NOT_FOUND',
      404,
      'Session not found',
      { sessionId }
    );
  }
}

export class InviteNotFoundError extends AppError {
  constructor(identifier: string) {
    super(
      'INVITE_NOT_FOUND',
      404,
      'Invitation not found',
      { identifier }
    );
  }
}

export class RoleNotFoundError extends AppError {
  constructor(roleId: string) {
    super(
      'ROLE_NOT_FOUND',
      404,
      'Role not found',
      { roleId }
    );
  }
}

// ============================================================================
// Conflict Errors (409)
// ============================================================================

export class ResourceConflictError extends AppError {
  constructor(resource: string, conflict: string) {
    super(
      'RESOURCE_CONFLICT',
      409,
      `${resource} already exists: ${conflict}`,
      { resource, conflict }
    );
  }
}

export class EmailAlreadyExistsError extends AppError {
  constructor(email: string) {
    super(
      'EMAIL_ALREADY_EXISTS',
      409,
      'An account with this email already exists',
      { email }
    );
  }
}

export class UsernameAlreadyExistsError extends AppError {
  constructor(username: string) {
    super(
      'USERNAME_ALREADY_EXISTS',
      409,
      'This username is already taken',
      { username }
    );
  }
}

export class InviteAlreadyUsedError extends AppError {
  constructor(inviteId: string) {
    super(
      'INVITE_ALREADY_USED',
      409,
      'This invitation has already been used',
      { inviteId }
    );
  }
}

// ============================================================================
// Gone Errors (410)
// ============================================================================

export class InviteExpiredError extends AppError {
  constructor(expiredAt: Date) {
    super(
      'INVITE_EXPIRED',
      410,
      'This invitation has expired',
      { expiredAt: expiredAt.toISOString() }
    );
  }
}

export class ResetTokenExpiredError extends AppError {
  constructor() {
    super(
      'RESET_TOKEN_EXPIRED',
      410,
      'Password reset token has expired. Please request a new one.'
    );
  }
}

export class ResetTokenInvalidError extends AppError {
  constructor() {
    super(
      'RESET_TOKEN_INVALID',
      401,
      'Invalid or expired password reset token'
    );
  }
}

export class ResetTokenUsedError extends AppError {
  constructor() {
    super(
      'RESET_TOKEN_USED',
      422,
      'Password reset token has already been used'
    );
  }
}

// ============================================================================
// Validation Errors (400)
// ============================================================================

export class ValidationError extends AppError {
  constructor(errors: Array<{ field: string; message: string }>) {
    super(
      'VALIDATION_ERROR',
      400,
      'Request validation failed',
      { errors }
    );
  }
}

export class InvalidPasswordError extends AppError {
  constructor(requirements?: string[]) {
    super(
      'INVALID_PASSWORD',
      400,
      'Password does not meet requirements',
      requirements ? { requirements } : undefined
    );
  }
}

export class PasswordReuseError extends AppError {
  constructor() {
    super(
      'PASSWORD_REUSE',
      400,
      'Cannot reuse a recent password. Please choose a different password.'
    );
  }
}

export class InvalidEmailError extends AppError {
  constructor(email: string) {
    super(
      'INVALID_EMAIL',
      400,
      'Invalid email format',
      { email }
    );
  }
}

export class InvalidInviteError extends AppError {
  constructor(message: string = 'Invalid invite') {
    super(
      'INVALID_INVITE',
      400,
      message
    );
  }
}

// ============================================================================
// Rate Limiting Errors (429)
// ============================================================================

export class RateLimitExceededError extends AppError {
  constructor(retryAfter: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      429,
      'Too many requests. Please try again later.',
      { retryAfter, retryAfterSeconds: Math.ceil(retryAfter / 1000) }
    );
  }
}

export class TooManyLoginAttemptsError extends AppError {
  constructor(retryAfter: number) {
    super(
      'TOO_MANY_LOGIN_ATTEMPTS',
      429,
      'Too many login attempts. Please try again later.',
      { retryAfter, retryAfterSeconds: Math.ceil(retryAfter / 1000) }
    );
  }
}

// ============================================================================
// Business Logic Errors (422)
// ============================================================================

export class InviteRevokedError extends AppError {
  constructor(reason?: string) {
    super(
      'INVITE_REVOKED',
      422,
      'This invitation has been revoked',
      reason ? { reason } : undefined
    );
  }
}

export class SessionRevokedError extends AppError {
  constructor(reason?: string) {
    super(
      'SESSION_REVOKED',
      422,
      'This session has been revoked',
      reason ? { reason } : undefined
    );
  }
}

export class OperationNotAllowedError extends AppError {
  constructor(operation: string, reason: string) {
    super(
      'OPERATION_NOT_ALLOWED',
      422,
      `Operation not allowed: ${reason}`,
      { operation, reason }
    );
  }
}

// ============================================================================
// Server Errors (500)
// ============================================================================

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      'DATABASE_ERROR',
      500,
      'A database error occurred',
      {
        operation,
        ...(process.env.NODE_ENV === 'development' && originalError && {
          originalMessage: originalError.message
        })
      }
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      500,
      `External service error: ${service}`,
      {
        service,
        ...(process.env.NODE_ENV === 'development' && originalError && {
          originalMessage: originalError.message
        })
      }
    );
  }
}

export class CacheError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      'CACHE_ERROR',
      500,
      'A caching error occurred',
      {
        operation,
        ...(process.env.NODE_ENV === 'development' && originalError && {
          originalMessage: originalError.message
        })
      }
    );
  }
}
