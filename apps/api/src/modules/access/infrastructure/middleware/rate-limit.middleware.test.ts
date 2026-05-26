import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { AppError, RateLimitExceededError } from "../../../../shared/errors";

const mockCheck = mock(() =>
  Promise.resolve({
    allowed: true,
    remaining: 4,
    resetAt: new Date(Date.now() + 60_000),
  })
);

mock.module("../../../../infrastructure/cache/rate-limiter.service", () => ({
  rateLimiterService: {
    check: mockCheck,
  },
}));

import {
  createRateLimitMiddleware,
  getLoginRateLimitKey,
  getPasswordResetRateLimitKey,
  getPasswordResetConfirmRateLimitKey,
} from "./rate-limit.middleware";

function createTestApp(handler: ReturnType<typeof createRateLimitMiddleware>) {
  return new Elysia()
    .onBeforeHandle(handler)
    .post("/test", () => ({ ok: true }))
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.toJSON() };
      }
      throw error;
    });
}

describe("rate-limit.middleware", () => {
  beforeEach(() => {
    mockCheck.mockReset();
    mockCheck.mockImplementation(() =>
      Promise.resolve({
        allowed: true,
        remaining: 4,
        resetAt: new Date(Date.now() + 60_000),
      })
    );
  });

  describe("key generators", () => {
    it("login key uses body.identifier", () => {
      const key = getLoginRateLimitKey({
        body: { identifier: "user@example.com" },
        request: new Request("http://localhost/login"),
      });

      expect(key).toBe("user@example.com");
    });

    it("login key falls back to IP when identifier is missing", () => {
      const key = getLoginRateLimitKey({
        body: {},
        request: new Request("http://localhost/login", {
          headers: { "x-forwarded-for": "203.0.113.10" },
        }),
      });

      expect(key).toBe("203.0.113.10");
    });

    it("login key does not use email or username fields", () => {
      const key = getLoginRateLimitKey({
        body: { email: "user@example.com", username: "testuser" } as any,
        request: new Request("http://localhost/login", {
          headers: { "x-real-ip": "203.0.113.20" },
        }),
      });

      expect(key).toBe("203.0.113.20");
    });

    it("password reset key uses body.identifier", () => {
      const key = getPasswordResetRateLimitKey({
        body: { identifier: "+15551234567" },
        request: new Request("http://localhost/password-reset/request"),
      });

      expect(key).toBe("+15551234567");
    });

    it("password reset confirm key uses IP and token prefix", () => {
      const key = getPasswordResetConfirmRateLimitKey({
        body: { token: "abcdefgh1234567890" },
        request: new Request("http://localhost/password-reset/confirm", {
          headers: { "x-real-ip": "203.0.113.30" },
        }),
      });

      expect(key).toBe("203.0.113.30:abcdefgh");
    });
  });

  describe("createRateLimitMiddleware", () => {
    it("passes identifier from login key generator to rateLimiterService.check", async () => {
      const middleware = createRateLimitMiddleware("login", {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        keyGenerator: getLoginRateLimitKey,
      });

      const app = createTestApp(middleware);
      await app.handle(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: "user@example.com" }),
        })
      );

      expect(mockCheck).toHaveBeenCalledWith(
        "login",
        "user@example.com",
        expect.objectContaining({ maxAttempts: 5 })
      );
    });

    it("throws RateLimitExceededError when check returns allowed: false", async () => {
      const resetAt = new Date(Date.now() + 900_000);
      mockCheck.mockImplementation(() =>
        Promise.resolve({
          allowed: false,
          remaining: 0,
          resetAt,
        })
      );

      const middleware = createRateLimitMiddleware("password-reset", {
        maxAttempts: 3,
        windowMs: 60 * 60 * 1000,
        keyGenerator: getPasswordResetRateLimitKey,
      });

      const context = {
        body: { identifier: "user@example.com" },
        request: new Request("http://localhost/test"),
        set: { headers: {} as Record<string, string>, status: 200 },
      };

      await expect(middleware(context)).rejects.toThrow(RateLimitExceededError);
      expect(context.set.headers["retry-after"]).toBeTruthy();
      expect(context.set.headers["x-ratelimit-limit"]).toBe("3");
      expect(context.set.headers["x-ratelimit-remaining"]).toBe("0");
    });
  });
});
