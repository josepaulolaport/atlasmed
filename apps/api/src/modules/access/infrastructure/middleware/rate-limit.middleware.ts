import { createRateLimitMiddleware } from "../../../../infrastructure/middleware/global-rate-limit.middleware";

/**
 * Business-aware rate limiting middleware for access module.
 * 
 * These rate limiters understand business concepts like:
 * - Users and authentication
 * - Invitations
 * - Login attempts
 * - Password resets
 */

export const inviteRateLimitMiddleware = createRateLimitMiddleware("invite", {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (context: any) => {
    return context.auth?.user?.id || "anonymous";
  },
  message: "Too many invitation attempts. Please try again later.",
});

export const loginRateLimitMiddleware = createRateLimitMiddleware("login", {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
  keyGenerator: (context: any) => {
    const identifier = context.body?.email || context.body?.username;
    return identifier || "anonymous";
  },
  message: "Too many login attempts. Your account has been temporarily locked.",
});

export const passwordResetRateLimitMiddleware = createRateLimitMiddleware(
  "password-reset",
  {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
    keyGenerator: (context: any) => {
      const identifier = context.body?.email || context.body?.phoneNumber;
      return identifier || "anonymous";
    },
    message: "Too many password reset requests. Please try again later.",
  }
);
