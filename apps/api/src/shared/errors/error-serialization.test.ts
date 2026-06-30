import { describe, expect, it } from "bun:test";
import {
  AccountLockedError,
  InsufficientPermissionsError,
  InvalidPasswordError,
  RateLimitExceededError,
  RefreshTokenReuseDetectedError,
  ResourceNotFoundError,
  SessionSecurityViolationError,
  TokenInvalidError,
  UserNotFoundError,
  ValidationError,
} from "./domain-errors";

describe("AppError.toClientJSON", () => {
  it("strips internal context from RefreshTokenReuseDetectedError", () => {
    const error = new RefreshTokenReuseDetectedError({
      userId: "user-123",
      sessionId: "session-456",
    });

    expect(error.toClientJSON()).toEqual({
      code: "REFRESH_TOKEN_REUSE_DETECTED",
      message: error.message,
    });
    expect(error.toClientJSON()).not.toHaveProperty("context");
    expect(error.toClientJSON()).not.toHaveProperty("userId");
    expect(error.toClientJSON()).not.toHaveProperty("sessionId");
  });

  it("strips internal reason from TokenInvalidError", () => {
    const error = new TokenInvalidError("Refresh token was already rotated");

    expect(error.toClientJSON()).toEqual({
      code: "TOKEN_INVALID",
      message: error.message,
    });
  });

  it("strips internal reason from SessionSecurityViolationError", () => {
    const error = new SessionSecurityViolationError("ip_mismatch");

    expect(error.toClientJSON()).toEqual({
      code: "SESSION_SECURITY_VIOLATION",
      message: error.message,
    });
  });

  it("strips identifiers from UserNotFoundError and ResourceNotFoundError", () => {
    expect(new UserNotFoundError("user@test.com").toClientJSON()).toEqual({
      code: "USER_NOT_FOUND",
      message: "User not found",
    });

    expect(new ResourceNotFoundError("Clinic", "clinic-1").toClientJSON()).toEqual({
      code: "RESOURCE_NOT_FOUND",
      message: "Facility not found",
    });
  });

  it("strips permission arrays from InsufficientPermissionsError", () => {
    const error = new InsufficientPermissionsError(["manage USER"], ["read USER"]);

    expect(error.toClientJSON()).toEqual({
      code: "INSUFFICIENT_PERMISSIONS",
      message: error.message,
    });
  });

  it("exposes retryAfterSeconds for rate limit errors", () => {
    const error = new RateLimitExceededError(30_000);

    expect(error.toClientJSON()).toEqual({
      code: "RATE_LIMIT_EXCEEDED",
      message: error.message,
      retryAfterSeconds: 30,
    });
  });

  it("exposes unlockAt for AccountLockedError", () => {
    const unlockAt = new Date("2026-01-01T00:00:00.000Z");
    const error = new AccountLockedError(unlockAt);

    expect(error.toClientJSON()).toEqual({
      code: "ACCOUNT_LOCKED",
      message: error.message,
      unlockAt: unlockAt.toISOString(),
    });
  });

  it("exposes validation errors for ValidationError", () => {
    const errors = [{ field: "email", message: "Invalid email" }];
    const error = new ValidationError(errors);

    expect(error.toClientJSON()).toEqual({
      code: "VALIDATION_ERROR",
      message: error.message,
      errors,
    });
  });

  it("exposes requirements for InvalidPasswordError", () => {
    const requirements = ["Minimum 12 characters"];
    const error = new InvalidPasswordError(requirements);

    expect(error.toClientJSON()).toEqual({
      code: "INVALID_PASSWORD",
      message: error.message,
      requirements,
    });
  });

  it("retains full context in toJSON for server logging", () => {
    const error = new RefreshTokenReuseDetectedError({
      userId: "user-123",
      sessionId: "session-456",
    });

    expect(error.toJSON().context).toEqual({
      userId: "user-123",
      sessionId: "session-456",
    });
  });
});
