# Error Codes Reference

This document provides a comprehensive reference for all error codes returned by the AtlasMed API.

## Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "context": {
      // Optional: Additional error context
    }
  }
}
```

## HTTP Status Codes

| Status | Category | Description |
|--------|----------|-------------|
| 400 | Bad Request | Invalid request data or validation errors |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists |
| 410 | Gone | Resource expired or no longer available |
| 422 | Unprocessable Entity | Business logic validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

## Authentication Errors (401)

### INVALID_CREDENTIALS
Invalid email/username or password.

**Response:**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### SESSION_EXPIRED
User session has expired and needs to login again.

**Response:**
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Your session has expired. Please login again."
  }
}
```

### TOKEN_INVALID
Authentication token is invalid or malformed.

**Response:**
```json
{
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Invalid or malformed authentication token",
    "context": {
      "reason": "Token signature verification failed"
    }
  }
}
```

### TOKEN_EXPIRED
Authentication token has expired.

**Response:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Authentication token has expired"
  }
}
```

## Authorization Errors (403)

### INSUFFICIENT_PERMISSIONS
User does not have required permissions.

**Response:**
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to perform this action",
    "context": {
      "required": ["admin"],
      "has": ["user"]
    }
  }
}
```

### ACCOUNT_SUSPENDED
User account has been suspended.

**Response:**
```json
{
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "Your account has been suspended",
    "context": {
      "reason": "Terms of service violation"
    }
  }
}
```

### ACCOUNT_DEACTIVATED
User account has been deactivated.

**Response:**
```json
{
  "error": {
    "code": "ACCOUNT_DEACTIVATED",
    "message": "Your account has been deactivated. Please contact support."
  }
}
```

### ACCOUNT_LOCKED
Account temporarily locked due to too many failed login attempts.

**Response:**
```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Your account has been temporarily locked due to too many failed login attempts",
    "context": {
      "unlockAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Resource Errors (404)

### RESOURCE_NOT_FOUND
Generic resource not found error.

**Response:**
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User not found",
    "context": {
      "resource": "User",
      "identifier": "123"
    }
  }
}
```

### USER_NOT_FOUND
User does not exist.

**Response:**
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "context": {
      "identifier": "user@example.com"
    }
  }
}
```

### SESSION_NOT_FOUND
Session does not exist.

**Response:**
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found",
    "context": {
      "sessionId": "sess_123"
    }
  }
}
```

### INVITE_NOT_FOUND
Invitation does not exist.

**Response:**
```json
{
  "error": {
    "code": "INVITE_NOT_FOUND",
    "message": "Invitation not found",
    "context": {
      "identifier": "invite_token_123"
    }
  }
}
```

### ROLE_NOT_FOUND
Role does not exist.

**Response:**
```json
{
  "error": {
    "code": "ROLE_NOT_FOUND",
    "message": "Role not found",
    "context": {
      "roleId": "role_123"
    }
  }
}
```

## Conflict Errors (409)

### RESOURCE_CONFLICT
Generic resource conflict error.

**Response:**
```json
{
  "error": {
    "code": "RESOURCE_CONFLICT",
    "message": "User already exists: email conflict",
    "context": {
      "resource": "User",
      "conflict": "email conflict"
    }
  }
}
```

### EMAIL_ALREADY_EXISTS
Email is already registered.

**Response:**
```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email already exists",
    "context": {
      "email": "user@example.com"
    }
  }
}
```

### USERNAME_ALREADY_EXISTS
Username is already taken.

**Response:**
```json
{
  "error": {
    "code": "USERNAME_ALREADY_EXISTS",
    "message": "This username is already taken",
    "context": {
      "username": "johndoe"
    }
  }
}
```

### INVITE_ALREADY_USED
Invitation has already been used.

**Response:**
```json
{
  "error": {
    "code": "INVITE_ALREADY_USED",
    "message": "This invitation has already been used",
    "context": {
      "inviteId": "invite_123"
    }
  }
}
```

## Gone Errors (410)

### INVITE_EXPIRED
Invitation has expired.

**Response:**
```json
{
  "error": {
    "code": "INVITE_EXPIRED",
    "message": "This invitation has expired",
    "context": {
      "expiredAt": "2024-01-10T10:00:00Z"
    }
  }
}
```

### RESET_TOKEN_EXPIRED
Password reset token has expired.

**Response:**
```json
{
  "error": {
    "code": "RESET_TOKEN_EXPIRED",
    "message": "Password reset token has expired. Please request a new one."
  }
}
```

## Validation Errors (400)

### VALIDATION_ERROR
Request validation failed.

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "context": {
      "errors": [
        { "field": "email", "message": "Invalid email format" },
        { "field": "password", "message": "Password too short" }
      ]
    }
  }
}
```

### INVALID_PASSWORD
Password does not meet requirements.

**Response:**
```json
{
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Password does not meet requirements",
    "context": {
      "requirements": [
        "At least 8 characters",
        "Contains uppercase letters",
        "Contains lowercase letters",
        "Contains numbers"
      ]
    }
  }
}
```

### INVALID_EMAIL
Email format is invalid.

**Response:**
```json
{
  "error": {
    "code": "INVALID_EMAIL",
    "message": "Invalid email format",
    "context": {
      "email": "invalid-email"
    }
  }
}
```

## Rate Limiting Errors (429)

### RATE_LIMIT_EXCEEDED
Too many requests from client.

**Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "context": {
      "retryAfter": 900000,
      "retryAfterSeconds": 900
    }
  }
}
```

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until retry allowed

### TOO_MANY_LOGIN_ATTEMPTS
Too many failed login attempts.

**Response:**
```json
{
  "error": {
    "code": "TOO_MANY_LOGIN_ATTEMPTS",
    "message": "Too many login attempts. Please try again later.",
    "context": {
      "retryAfter": 900000,
      "retryAfterSeconds": 900
    }
  }
}
```

## Business Logic Errors (422)

### INVITE_REVOKED
Invitation has been revoked.

**Response:**
```json
{
  "error": {
    "code": "INVITE_REVOKED",
    "message": "This invitation has been revoked",
    "context": {
      "reason": "No longer needed"
    }
  }
}
```

### SESSION_REVOKED
Session has been revoked.

**Response:**
```json
{
  "error": {
    "code": "SESSION_REVOKED",
    "message": "This session has been revoked",
    "context": {
      "reason": "Security policy"
    }
  }
}
```

### OPERATION_NOT_ALLOWED
Operation is not allowed in current state.

**Response:**
```json
{
  "error": {
    "code": "OPERATION_NOT_ALLOWED",
    "message": "Operation not allowed: Cannot delete own account",
    "context": {
      "operation": "delete_account",
      "reason": "Cannot delete own account"
    }
  }
}
```

## Server Errors (500)

### DATABASE_ERROR
Database operation failed.

**Response:**
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "A database error occurred",
    "context": {
      "operation": "user_create"
    }
  }
}
```

### EXTERNAL_SERVICE_ERROR
External service (email, SMS) failed.

**Response:**
```json
{
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "External service error: email_service",
    "context": {
      "service": "email_service"
    }
  }
}
```

### CACHE_ERROR
Caching operation failed.

**Response:**
```json
{
  "error": {
    "code": "CACHE_ERROR",
    "message": "A caching error occurred",
    "context": {
      "operation": "session_cache_get"
    }
  }
}
```

### INTERNAL_SERVER_ERROR
Unexpected server error.

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

## Best Practices for Error Handling

### Client-Side

1. **Always check the error code** instead of parsing error messages
2. **Display user-friendly messages** based on error codes
3. **Handle rate limits gracefully** with exponential backoff
4. **Show context information** when available (e.g., retry after time)

Example:
```typescript
try {
  const response = await api.login(credentials);
} catch (error) {
  const errorCode = error.response?.data?.error?.code;
  
  switch (errorCode) {
    case 'INVALID_CREDENTIALS':
      showError('Invalid email or password');
      break;
    case 'TOO_MANY_LOGIN_ATTEMPTS':
      const retryAfter = error.response.data.error.context.retryAfterSeconds;
      showError(`Too many attempts. Try again in ${retryAfter} seconds`);
      break;
    case 'ACCOUNT_SUSPENDED':
      showError('Your account has been suspended. Contact support.');
      break;
    default:
      showError('An error occurred. Please try again.');
  }
}
```

### Server-Side

1. **Use typed errors** for all domain logic
2. **Include relevant context** for debugging
3. **Log errors appropriately** with request context
4. **Never expose sensitive information** in error responses
5. **Use appropriate HTTP status codes**

## Migration Guide

### From Old Error Handling

**Before:**
```typescript
throw new Error('Invalid credentials');
```

**After:**
```typescript
throw new InvalidCredentialsError();
```

### Custom Context

**Before:**
```typescript
throw new Error(`User not found: ${userId}`);
```

**After:**
```typescript
throw new UserNotFoundError(userId);
```

## Support

For questions or issues with error codes:
- Review this documentation
- Check the API logs for detailed error context
- Contact the development team for clarification
