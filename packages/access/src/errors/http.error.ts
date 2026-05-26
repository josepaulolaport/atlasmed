/**
 * Base HTTP error class that carries its own status code.
 * This allows generic error handlers to map errors to HTTP responses
 * without knowing about specific domain error types.
 */
export abstract class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
