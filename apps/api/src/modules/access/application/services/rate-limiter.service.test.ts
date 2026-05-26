import { beforeEach, describe, expect, it, mock } from "bun:test";
import type Redis from "ioredis";
import { TooManyLoginAttemptsError } from "../../../../shared/errors";
import { RateLimiterService } from "./rate-limiter.service";

describe("RateLimiterService", () => {
  let rateLimiterService: RateLimiterService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: mock(() => Promise.resolve(null)),
      incr: mock(() => Promise.resolve(1)),
      setex: mock(() => Promise.resolve("OK")),
      expire: mock(() => Promise.resolve(1)),
      del: mock(() => Promise.resolve(1)),
      ttl: mock(() => Promise.resolve(900)),
    } as unknown as Redis;

    rateLimiterService = new RateLimiterService({ redis: mockRedis });
  });

  describe("checkLoginAttempts", () => {
    it("should allow login when no previous attempts", async () => {
      await expect(rateLimiterService.checkLoginAttempts("user@example.com")).resolves.toBeUndefined();
    });

    it("should allow login with less than max attempts", async () => {
      mockRedis.get = mock((key: string) => {
        if (key.includes("login_attempts")) return Promise.resolve("3");
        return Promise.resolve(null);
      });

      await expect(rateLimiterService.checkLoginAttempts("user@example.com")).resolves.toBeUndefined();
    });

    it("should throw error when account is locked", async () => {
      mockRedis.get = mock((key: string) => {
        if (key.includes("account_locked")) return Promise.resolve("1");
        return Promise.resolve(null);
      });
      mockRedis.ttl = mock(() => Promise.resolve(600));

      await expect(rateLimiterService.checkLoginAttempts("user@example.com")).rejects.toThrow(
        TooManyLoginAttemptsError
      );
    });

    it("should lock account after max attempts", async () => {
      mockRedis.get = mock((key: string) => {
        if (key.includes("login_attempts")) return Promise.resolve("5");
        return Promise.resolve(null);
      });

      await expect(rateLimiterService.checkLoginAttempts("user@example.com")).rejects.toThrow(
        TooManyLoginAttemptsError
      );

      expect(mockRedis.setex).toHaveBeenCalledWith("account_locked:user@example.com", 900, "1");
    });
  });

  describe("recordFailedAttempt", () => {
    it("should increment attempt counter", async () => {
      mockRedis.incr = mock(() => Promise.resolve(1));

      await rateLimiterService.recordFailedAttempt("user@example.com");

      expect(mockRedis.incr).toHaveBeenCalledWith("login_attempts:user@example.com");
      expect(mockRedis.expire).toHaveBeenCalledWith("login_attempts:user@example.com", 900);
    });

    it("should not reset expiry on subsequent attempts", async () => {
      mockRedis.incr = mock(() => Promise.resolve(3));

      await rateLimiterService.recordFailedAttempt("user@example.com");

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe("clearAttempts", () => {
    it("should delete attempt counter", async () => {
      await rateLimiterService.clearAttempts("user@example.com");

      expect(mockRedis.del).toHaveBeenCalledWith("login_attempts:user@example.com");
    });
  });

  describe("getRemainingAttempts", () => {
    it("should return max attempts when no previous attempts", async () => {
      const remaining = await rateLimiterService.getRemainingAttempts("user@example.com");
      expect(remaining).toBe(5);
    });

    it("should return correct remaining attempts", async () => {
      mockRedis.get = mock(() => Promise.resolve("3"));

      const remaining = await rateLimiterService.getRemainingAttempts("user@example.com");
      expect(remaining).toBe(2);
    });

    it("should return 0 when max attempts reached", async () => {
      mockRedis.get = mock(() => Promise.resolve("5"));

      const remaining = await rateLimiterService.getRemainingAttempts("user@example.com");
      expect(remaining).toBe(0);
    });
  });
});
