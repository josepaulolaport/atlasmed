/**
 * Base Error Class for AtlasMed API
 *
 * All domain-specific errors should extend this class.
 * Provides consistent error structure with machine-readable codes.
 */

/** Context keys safe to expose in client-facing API responses, keyed by error code. */
const CLIENT_SAFE_CONTEXT_KEYS: Record<string, readonly string[]> = {
  RATE_LIMIT_EXCEEDED: ["retryAfterSeconds"],
  TOO_MANY_LOGIN_ATTEMPTS: ["retryAfterSeconds"],
  ACCOUNT_LOCKED: ["unlockAt"],
  VALIDATION_ERROR: ["errors"],
  INVALID_PASSWORD: ["requirements"],
  INVITE_EXPIRED: ["expiredAt"],
  CALENDAR_CONFLICT: ["conflicts"],
  CALENDAR_VERSION_CONFLICT: ["calendarId", "expectedVersion"],
  // Spec 0009 R6: the delta is the entire point of this error — without it the
  // caller can only re-preview and diff by hand. Safe to expose: these are the
  // ids of clinics the caller just previewed, under their own scope.
  BOUNDARY_IMPACT_SET_CHANGED: ["added", "removed"],
  // Spec 0009 R5: the reviewer has to see *which* reps a move would strand
  // before deciding, so the list is part of the client-facing payload.
  FACILITY_COVERAGE_LOSS: ["losingCoverage"],
};

export abstract class AppError extends Error {
  /**
   * @param code - Machine-readable error code (e.g., 'INVALID_CREDENTIALS')
   * @param statusCode - HTTP status code (e.g., 401, 404, 500)
   * @param message - Human-readable error message
   * @param context - Additional error context for debugging (server-side only)
   */
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Sanitized JSON for API responses — never exposes internal context by default.
   */
  toClientJSON(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      code: this.code,
      message: this.message,
    };

    if (!this.context) {
      return payload;
    }

    const safeKeys = CLIENT_SAFE_CONTEXT_KEYS[this.code];
    if (!safeKeys) {
      return payload;
    }

    for (const key of safeKeys) {
      if (key in this.context) {
        payload[key] = this.context[key];
      }
    }

    return payload;
  }

  /**
   * Full JSON including context — for server-side logging only.
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.context && { context: this.context }),
      ...(process.env.NODE_ENV === "development" && { stack: this.stack }),
    };
  }

  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}
