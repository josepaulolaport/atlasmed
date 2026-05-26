import { describe, expect, test, beforeEach, mock } from "bun:test";
import { AuthCacheService } from "./auth-cache.service";
import { RedisCacheError } from "../../../../shared/utils/redis-retry";
import type { Redis } from "ioredis";

describe("AuthCacheService", () => {
  let mockRedis: Redis;
  let cache: AuthCacheService;

  beforeEach(() => {
    mockRedis = {
      get: mock(() => Promise.resolve(null)),
      setex: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(0)),
    } as unknown as Redis;

    cache = new AuthCacheService(mockRedis);
  });

  describe("get", () => {
    test("should return null when key does not exist", async () => {
      const result = await cache.get("user-123");
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith("auth:user:user-123");
    });

    test("should return cached auth context", async () => {
      const authContext = {
        userId: "user-123",
        roleId: "role-456",
        roleName: "ADMIN",
        status: "ACTIVE",
        tokenVersion: 1,
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(authContext)));

      const result = await cache.get("user-123");
      expect(result).toEqual(authContext);
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.get = mock(() => Promise.reject(new Error("Redis error")));

      const result = await cache.get("user-123");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    test("should cache auth context with TTL", async () => {
      const authContext = {
        userId: "user-123",
        roleId: "role-456",
        roleName: "ADMIN",
        status: "ACTIVE",
        tokenVersion: 1,
      };

      await cache.set("user-123", authContext);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "auth:user:user-123",
        3600,
        JSON.stringify(authContext)
      );
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.setex = mock(() => Promise.reject(new Error("Redis error")));

      const authContext = {
        userId: "user-123",
        roleId: "role-456",
        roleName: "ADMIN",
        status: "ACTIVE",
        tokenVersion: 1,
      };

      await expect(cache.set("user-123", authContext)).resolves.toBeUndefined();
    });
  });

  describe("invalidate", () => {
    test("should delete auth context and validation stamp from cache", async () => {
      await cache.invalidate("user-123");
      expect(mockRedis.del).toHaveBeenCalledWith(
        "auth:validated:user-123",
        "auth:user:user-123"
      );
    });

    test("should throw after Redis retries are exhausted", async () => {
      mockRedis.del = mock(() => Promise.reject(new Error("Redis error")));

      await expect(cache.invalidate("user-123")).rejects.toBeInstanceOf(
        RedisCacheError
      );
    });
  });

  describe("invalidateMultiple", () => {
    test("should delete multiple auth contexts and validation stamps", async () => {
      await cache.invalidateMultiple(["user-123", "user-456"]);
      expect(mockRedis.del).toHaveBeenCalledWith(
        "auth:validated:user-123",
        "auth:user:user-123",
        "auth:validated:user-456",
        "auth:user:user-456"
      );
    });

    test("should not call Redis when array is empty", async () => {
      await cache.invalidateMultiple([]);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test("should throw after Redis retries are exhausted", async () => {
      mockRedis.del = mock(() => Promise.reject(new Error("Redis error")));
      await expect(
        cache.invalidateMultiple(["user-123"])
      ).rejects.toBeInstanceOf(RedisCacheError);
    });
  });

  describe("exists", () => {
    test("should return true when key exists", async () => {
      mockRedis.exists = mock(() => Promise.resolve(1));
      const result = await cache.exists("user-123");
      expect(result).toBe(true);
    });

    test("should return false when key does not exist", async () => {
      const result = await cache.exists("user-123");
      expect(result).toBe(false);
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.exists = mock(() => Promise.reject(new Error("Redis error")));
      const result = await cache.exists("user-123");
      expect(result).toBe(false);
    });
  });

  describe("validation helpers", () => {
    test("should report recently validated auth context", async () => {
      mockRedis.exists = mock(() => Promise.resolve(1));

      await expect(cache.isRecentlyValidated("user-123")).resolves.toBe(true);
    });

    test("should mark auth context as validated", async () => {
      await cache.markValidated("user-123");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "auth:validated:user-123",
        30,
        "1"
      );
    });
  });
});
