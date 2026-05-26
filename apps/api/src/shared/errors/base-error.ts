/**
 * Base Error Class for AtlasMed API
 * 
 * All domain-specific errors should extend this class.
 * Provides consistent error structure with machine-readable codes.
 */

export abstract class AppError extends Error {
  /**
   * @param code - Machine-readable error code (e.g., 'INVALID_CREDENTIALS')
   * @param statusCode - HTTP status code (e.g., 401, 404, 500)
   * @param message - Human-readable error message
   * @param context - Additional error context for debugging
   */
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.context && { context: this.context }),
      // Include stack trace only in development
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }

  /**
   * String representation of the error
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}
