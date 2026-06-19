import { describe, expect, test, beforeEach, mock } from "bun:test";
import { SessionCacheService } from "./session-cache.service";
import { RedisCacheError } from "../../../../shared/utils/redis-retry";
import type { Redis } from "ioredis";

describe("SessionCacheService", () => {
  let mockRedis: Redis;
  let cache: SessionCacheService;

  beforeEach(() => {
    mockRedis = {
      get: mock(() => Promise.resolve(null)),
      setex: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(0)),
      pipeline: mock(() => ({
        setex: mock(),
        sadd: mock(),
        expire: mock(),
        del: mock(),
        srem: mock(),
        exec: mock(() => Promise.resolve([])),
      })),
      smembers: mock(() => Promise.resolve([])),
    } as unknown as Redis;

    cache = new SessionCacheService(mockRedis);
  });

  describe("getById", () => {
    test("should return null when session does not exist", async () => {
      const result = await cache.getById("session-123");
      expect(result).toBeNull();
    });

    test("should return cached session", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date().toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(session)));

      const result = await cache.getById("session-123");
      expect(result).toEqual(session);
    });

    test("should handle Redis errors gracefully", async () => {
      mockRedis.get = mock(() => Promise.reject(new Error("Redis error")));
      const result = await cache.getById("session-123");
      expect(result).toBeNull();
    });
  });

  describe("getByTokenHash", () => {
    test("should return null when token does not exist", async () => {
      const result = await cache.getByTokenHash("token-hash");
      expect(result).toBeNull();
    });

    test("should return session when token exists", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date().toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      let callCount = 0;
      mockRedis.get = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve("session-123");
        }
        return Promise.resolve(JSON.stringify(session));
      });

      const result = await cache.getByTokenHash("token-hash");
      expect(result).toEqual(session);
    });
  });

  describe("set", () => {
    test("should cache session with TTL", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await cache.set(session);

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    test("should not cache expired session", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await cache.set(session);

      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    test("should delete session from cache", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date().toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(session)));

      await cache.invalidate("session-123");

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    test("should set revoked marker even when session is missing from cache", async () => {
      await cache.invalidate("session-123");

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    test("should throw after Redis retries are exhausted", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(session)));
      mockRedis.del = mock(() => Promise.reject(new Error("Redis error")));

      await expect(cache.invalidate("session-123")).rejects.toBeInstanceOf(
        RedisCacheError
      );
    });

    test("should handle missing session gracefully", async () => {
      await cache.invalidate("session-123");
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe("validation helpers", () => {
    test("should report recently validated sessions", async () => {
      mockRedis.exists = mock(() => Promise.resolve(1));

      await expect(cache.isRecentlyValidated("session-123")).resolves.toBe(true);
    });

    test("should mark session as validated", async () => {
      await cache.markValidated("session-123");

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    test("should report revoked marker", async () => {
      mockRedis.exists = mock(() => Promise.resolve(1));

      await expect(cache.isMarkedRevoked("session-123")).resolves.toBe(true);
    });
  });

  describe("invalidateByUserId", () => {
    test("should invalidate all user sessions", async () => {
      mockRedis.smembers = mock(() =>
        Promise.resolve(["session-1", "session-2"])
      );

      const session = {
        id: "session-1",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date().toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(session)));

      await cache.invalidateByUserId("user-123");

      expect(mockRedis.smembers).toHaveBeenCalled();
    });

    test("should exclude session when specified", async () => {
      mockRedis.smembers = mock(() =>
        Promise.resolve(["session-1", "session-2"])
      );

      await cache.invalidateByUserId("user-123", "session-1");

      expect(mockRedis.smembers).toHaveBeenCalled();
    });

    test("should handle empty session list", async () => {
      await cache.invalidateByUserId("user-123");
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe("updateLastSeen", () => {
    test("should update session last seen time", async () => {
      const session = {
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: null,
        ipAddress: "127.0.0.1",
        userAgent: "test",
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockRedis.get = mock(() => Promise.resolve(JSON.stringify(session)));

      await cache.updateLastSeen("session-123");

      expect(mockRedis.get).toHaveBeenCalled();
    });

    test("should handle missing session gracefully", async () => {
      await cache.updateLastSeen("session-123");
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });
});
