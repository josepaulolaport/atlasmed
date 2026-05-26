import {
  asRateLimitPlugin,
  createRateLimitMiddleware,
  getClientIp,
} from "../../../../infrastructure/middleware/global-rate-limit.middleware";
import { TooManyLoginAttemptsError } from "../../../../shared/errors";

/**
 * Business-aware rate limiting for access module routes.
 *
 * Login uses two layers (see login.route.ts):
 * - Route middleware below: total request volume per identifier/IP (credential stuffing)
 * - Use-case RateLimiterService: failed attempts only, account lockout, clears on success
 */

export function getLoginRateLimitKey(context: {
  body?: { identifier?: string };
  request: Request;
}): string {
  return context.body?.identifier || getClientIp(context);
}

export function getPasswordResetRateLimitKey(context: {
  body?: { identifier?: string };
  request: Request;
}): string {
  return context.body?.identifier || getClientIp(context);
}

export function getPasswordResetConfirmRateLimitKey(context: {
  body?: { token?: string };
  request: Request;
}): string {
  const ip = getClientIp(context);
  const token = context.body?.token;
  if (token && token.length >= 8) {
    return `${ip}:${token.slice(0, 8)}`;
  }
  return ip;
}

export const loginRateLimit = asRateLimitPlugin("login", {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
  keyGenerator: getLoginRateLimitKey,
  createError: (retryAfterMs) => new TooManyLoginAttemptsError(retryAfterMs),
});

export const passwordResetRateLimit = asRateLimitPlugin("password-reset", {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  keyGenerator: getPasswordResetRateLimitKey,
});

export const inviteRateLimit = asRateLimitPlugin("invite", {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: async (context) => {
    if (context.getUserId) {
      return await context.getUserId();
    }
    return getClientIp(context);
  },
});

export const refreshRateLimit = asRateLimitPlugin("refresh", {
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
  keyGenerator: getClientIp,
});

export const registerRateLimit = asRateLimitPlugin("register", {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: getClientIp,
});

export const verificationRateLimit = asRateLimitPlugin("verification", {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: async (context) => {
    if (context.getUserId) {
      return await context.getUserId();
    }
    return getClientIp(context);
  },
});

export const profileRateLimit = asRateLimitPlugin("profile", {
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
  keyGenerator: async (context) => {
    if (context.getUserId) {
      return await context.getUserId();
    }
    return getClientIp(context);
  },
});

export const sessionRevokeRateLimit = asRateLimitPlugin("session-revoke", {
  maxAttempts: 20,
  windowMs: 15 * 60 * 1000,
  keyGenerator: async (context) => {
    if (context.getUserId) {
      return await context.getUserId();
    }
    return getClientIp(context);
  },
});

export const passwordResetConfirmRateLimit = asRateLimitPlugin(
  "password-reset-confirm",
  {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    keyGenerator: getPasswordResetConfirmRateLimitKey,
  }
);

/** @internal Exported for unit tests */
export { createRateLimitMiddleware, getClientIp };
