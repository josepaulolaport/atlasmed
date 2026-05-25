import { Elysia } from "elysia";
import { HttpError } from "@atlasmed/access";

/**
 * Global error handler for runtime error normalization.
 * 
 * Responsibilities:
 * - Map framework validation errors to HTTP responses
 * - Map HttpError subclasses to their declared status codes
 * - Handle generic Error instances with fallback behavior
 * - Normalize error response format
 * 
 * This middleware is domain-agnostic and knows nothing about specific business errors.
 * Domain errors extend HttpError and carry their own status codes.
 */
export const errorHandler = new Elysia().onError(({ code, error, set }) => {
  // Handle Zod validation errors (framework-level)
  if (code === "VALIDATION") {
    set.status = 400;
    return {
      error: "Invalid request data",
      details: error.message,
    };
  }

  // Handle HttpError and its subclasses (domain errors that carry their own status codes)
  if (error instanceof HttpError) {
    set.status = error.statusCode;
    return { error: error.message };
  }

  // Handle generic Error with specific messages (fallback heuristics)
  if (error instanceof Error) {
    if (
      error.message.includes("already taken") ||
      error.message.includes("already exists")
    ) {
      set.status = 409; // Conflict
      return { error: error.message };
    }

    if (error.message.includes("not found")) {
      set.status = 404;
      return { error: error.message };
    }

    // Default to 500 for unknown errors
    set.status = 500;
    return {
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  }

  // Fallback for non-Error objects
  set.status = 500;
  return { error: "Internal server error" };
});
