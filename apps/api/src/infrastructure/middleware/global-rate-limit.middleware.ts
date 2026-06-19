import { Elysia } from "elysia";
import { rateLimiterService, type RateLimitConfig } from "../cache/rate-limiter.service";
import { RateLimitExceededError } from "../../shared/errors";
import { getClientIp } from "../../shared/utils/client-ip";

export type { RateLimitConfig };

export interface RateLimitOptions extends RateLimitConfig {
  keyGenerator?: (context: any) => string | Promise<string>;
  skipSuccessfulAttempts?: boolean;
  message?: string;
  createError?: (retryAfterMs: number) => Error;
}

export { getClientIp };

/**
 * Generic rate limiting middleware factory.
 *
 * Uses infrastructure RateLimiterService which fails open on Redis errors
 * (allows the request through when Redis is unavailable).
 */
export function createRateLimitMiddleware(
  namespace: string,
  options: RateLimitOptions
) {
  return async (context: any) => {
    const identifier = options.keyGenerator
      ? await options.keyGenerator(context)
      : getClientIp(context);

    const result = await rateLimiterService.check(namespace, identifier, {
      maxAttempts: options.maxAttempts,
      windowMs: options.windowMs,
      ...(options.blockDurationMs !== undefined && {
        blockDurationMs: options.blockDurationMs,
      }),
      ...(options.failClosed !== undefined && {
        failClosed: options.failClosed,
      }),
    });

    context.set.headers["x-ratelimit-limit"] = options.maxAttempts.toString();
    context.set.headers["x-ratelimit-remaining"] = result.remaining.toString();
    context.set.headers["x-ratelimit-reset"] = result.resetAt.toISOString();

    if (!result.allowed) {
      const retryAfterMs = result.blockedUntil
        ? Math.max(result.blockedUntil.getTime() - Date.now(), 1000)
        : Math.max(result.resetAt.getTime() - Date.now(), 1000);

      context.set.headers["retry-after"] = Math.ceil(
        retryAfterMs / 1000
      ).toString();

      const createError =
        options.createError ??
        ((retryAfter: number) => new RateLimitExceededError(retryAfter));

      throw createError(retryAfterMs);
    }
  };
}

export function asRateLimitPlugin(namespace: string, options: RateLimitOptions) {
  return new Elysia({ name: `rate-limit:${namespace}` }).onBeforeHandle(
    createRateLimitMiddleware(namespace, options)
  );
}
