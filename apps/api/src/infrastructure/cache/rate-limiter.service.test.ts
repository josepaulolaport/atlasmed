import { describe, expect, test, beforeEach, mock } from "bun:test";
import { RateLimiterService } from "./rate-limiter.service";
import type { Redis } from "ioredis";

describe("RateLimiterService", () => {
  let mockRedis: Redis;
  let rateLimiter: RateLimiterService;

  beforeEach(() => {
    mockRedis = {
      exists: mock(() => Promise.resolve(0)),
      ttl: mock(() => Promise.resolve(0)),
      zremrangebyscore: mock(() => Promise.resolve(0)),
      zcard: mock(() => Promise.resolve(0)),
      zadd: mock(() => Promise.resolve(1)),
      expire: mock(() => Promise.resolve(1)),
      zrange: mock(() => Promise.resolve([])),
      setex: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
    } as unknown as Redis;

    rateLimiter = new RateLimiterService(mockRedis);
  });

  describe("check", () => {
    test("should allow request when under limit", async () => {
      const config = {
        maxAttempts: 5,
        windowMs: 60000,
      };

      const result = await rateLimiter.check("test", "user-123", config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test("should block request when limit exceeded", async () => {
      mockRedis.zcard = mock(() => Promise.resolve(5));

      const config = {
        maxAttempts: 5,
        windowMs: 60000,
      };

      const result = await rateLimiter.check("test", "user-123", config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test("should block with duration when blockDurationMs is set", async () => {
      mockRedis.zcard = mock(() => Promise.resolve(5));

      const config = {
        maxAttempts: 5,
        windowMs: 60000,
        blockDurationMs: 300000,
      };

      const result = await rateLimiter.check("test", "user-123", config);

      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    test("should respect existing block", async () => {
      mockRedis.exists = mock(() => Promise.resolve(1));
      mockRedis.ttl = mock(() => Promise.resolve(100));

      const config = {
        maxAttempts: 5,
        windowMs: 60000,
        blockDurationMs: 300000,
      };

      const result = await rateLimiter.check("test", "user-123", config);

      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.exists = mock(() => Promise.reject(new Error("Redis error")));

      const config = {
        maxAttempts: 5,
        windowMs: 60000,
      };

      const result = await rateLimiter.check("test", "user-123", config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });

  describe("reset", () => {
    test("should reset rate limit and block keys", async () => {
      await rateLimiter.reset("test", "user-123");

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:test:user-123");
      expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:block:test:user-123");
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.del = mock(() => Promise.reject(new Error("Redis error")));
      await expect(
        rateLimiter.reset("test", "user-123")
      ).resolves.toBeUndefined();
    });
  });

  describe("getRemainingAttempts", () => {
    test("should return remaining attempts", async () => {
      mockRedis.zcard = mock(() => Promise.resolve(2));

      const remaining = await rateLimiter.getRemainingAttempts(
        "test",
        "user-123",
        5
      );

      expect(remaining).toBe(3);
    });

    test("should not return negative values", async () => {
      mockRedis.zcard = mock(() => Promise.resolve(10));

      const remaining = await rateLimiter.getRemainingAttempts(
        "test",
        "user-123",
        5
      );

      expect(remaining).toBe(0);
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.zcard = mock(() => Promise.reject(new Error("Redis error")));

      const remaining = await rateLimiter.getRemainingAttempts(
        "test",
        "user-123",
        5
      );

      expect(remaining).toBe(5);
    });
  });
});
