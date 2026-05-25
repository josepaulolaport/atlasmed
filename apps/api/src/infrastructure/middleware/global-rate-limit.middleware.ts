import type { Context } from "elysia";
import { rateLimiterService, type RateLimitConfig } from "../cache/rate-limiter.service";

export interface RateLimitOptions extends RateLimitConfig {
  keyGenerator?: (context: any) => string;
  skipSuccessfulAttempts?: boolean;
  message?: string;
}

/**
 * Generic rate limiting middleware factory.
 * 
 * This is framework-level infrastructure that knows nothing about business concepts.
 * Use this to create specific rate limiters in your modules.
 * 
 * @example
 * // In your module
 * const loginRateLimit = createRateLimitMiddleware("login", {
 *   maxAttempts: 5,
 *   windowMs: 15 * 60 * 1000,
 *   keyGenerator: (ctx) => ctx.body?.email || "anonymous"
 * });
 */
export function createRateLimitMiddleware(
  namespace: string,
  options: RateLimitOptions
) {
  return async (context: any) => {
    const identifier = options.keyGenerator
      ? options.keyGenerator(context)
      : context.request.headers.get("x-forwarded-for") ||
        context.request.headers.get("x-real-ip") ||
        "unknown";

    const result = await rateLimiterService.check(namespace, identifier, {
      maxAttempts: options.maxAttempts,
      windowMs: options.windowMs,
      ...(options.blockDurationMs !== undefined && { blockDurationMs: options.blockDurationMs }),
    });

    context.set.headers["x-ratelimit-limit"] = options.maxAttempts.toString();
    context.set.headers["x-ratelimit-remaining"] = result.remaining.toString();
    context.set.headers["x-ratelimit-reset"] = result.resetAt.toISOString();

    if (!result.allowed) {
      if (result.blockedUntil) {
        context.set.headers["retry-after"] = Math.ceil(
          (result.blockedUntil.getTime() - Date.now()) / 1000
        ).toString();
      }

      context.set.status = 429;
      return {
        error:
          options.message ||
          "Too many requests. Please try again later.",
        retryAfter: result.resetAt.toISOString(),
      };
    }
  };
}
