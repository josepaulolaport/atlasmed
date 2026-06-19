import type { Redis } from "ioredis";
import { redis } from "../../../../infrastructure/cache/redis.client";
import {
  REDIS_CACHE_RETRY_ATTEMPTS,
  REDIS_CACHE_RETRY_DELAY_MS,
  SESSION_REVOKED_MARKER_TTL_SECONDS,
  SESSION_STATUS_REVALIDATION_SECONDS,
} from "../../application/constants/cache.constants";
import type {
  ISessionCache,
  CachedSession,
  SupersededRefreshTokenInfo,
} from "../../application/interfaces/session-cache.interface";
import { withRedisRetry } from "../../../../shared/utils/redis-retry";

export class SessionCacheService implements ISessionCache {
  private readonly redis: Redis;
  private readonly sessionKeyPrefix = "session:id:";
  private readonly tokenKeyPrefix = "session:token:";
  private readonly userSessionsKeyPrefix = "session:user:";
  private readonly revokedKeyPrefix = "session:revoked:";
  private readonly validatedKeyPrefix = "session:validated:";
  private readonly supersededKeyPrefix = "session:superseded:";
  private readonly ttl = 86400;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  private getSessionKey(sessionId: string): string {
    return `${this.sessionKeyPrefix}${sessionId}`;
  }

  private getTokenKey(tokenHash: string): string {
    return `${this.tokenKeyPrefix}${tokenHash}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.userSessionsKeyPrefix}${userId}`;
  }

  private getRevokedKey(sessionId: string): string {
    return `${this.revokedKeyPrefix}${sessionId}`;
  }

  private getValidatedKey(sessionId: string): string {
    return `${this.validatedKeyPrefix}${sessionId}`;
  }

  private getSupersededKey(tokenHash: string): string {
    return `${this.supersededKeyPrefix}${tokenHash}`;
  }

  private getRevokedMarkerTtl(expiresAt?: string): number {
    if (!expiresAt) {
      return SESSION_REVOKED_MARKER_TTL_SECONDS;
    }

    const ttl = Math.floor(
      (new Date(expiresAt).getTime() - Date.now()) / 1000
    );

    return ttl > 0 ? ttl : SESSION_REVOKED_MARKER_TTL_SECONDS;
  }

  private async markRevoked(
    sessionId: string,
    expiresAt?: string
  ): Promise<void> {
    await withRedisRetry(
      () =>
        this.redis.setex(
          this.getRevokedKey(sessionId),
          this.getRevokedMarkerTtl(expiresAt),
          "1"
        ),
      {
        attempts: REDIS_CACHE_RETRY_ATTEMPTS,
        delayMs: REDIS_CACHE_RETRY_DELAY_MS,
        operationName: "session cache markRevoked",
      }
    );
  }

  private async clearValidated(sessionId: string): Promise<void> {
    await withRedisRetry(() => this.redis.del(this.getValidatedKey(sessionId)), {
      attempts: REDIS_CACHE_RETRY_ATTEMPTS,
      delayMs: REDIS_CACHE_RETRY_DELAY_MS,
      operationName: "session cache clearValidated",
    });
  }

  async getById(sessionId: string): Promise<CachedSession | null> {
    try {
      const data = await this.redis.get(this.getSessionKey(sessionId));

      if (!data) {
        return null;
      }

      return JSON.parse(data) as CachedSession;
    } catch (error) {
      console.error("Failed to get session from cache:", error);
      return null;
    }
  }

  async getSupersededSession(
    tokenHash: string
  ): Promise<SupersededRefreshTokenInfo | null> {
    try {
      const data = await this.redis.get(this.getSupersededKey(tokenHash));

      if (!data) {
        return null;
      }

      return JSON.parse(data) as SupersededRefreshTokenInfo;
    } catch (error) {
      console.error("Failed to get superseded refresh token from cache:", error);
      return null;
    }
  }

  async getByTokenHash(tokenHash: string): Promise<CachedSession | null> {
    try {
      const sessionId = await this.redis.get(this.getTokenKey(tokenHash));

      if (!sessionId) {
        return null;
      }

      return await this.getById(sessionId);
    } catch (error) {
      console.error("Failed to get session by token hash from cache:", error);
      return null;
    }
  }

  async set(session: CachedSession): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(session.id);
      const tokenKey = this.getTokenKey(session.refreshTokenHash);
      const userSessionsKey = this.getUserSessionsKey(session.userId);

      const ttl = Math.floor(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000
      );

      if (ttl <= 0) {
        return;
      }

      const pipeline = this.redis.pipeline();

      pipeline.setex(sessionKey, ttl, JSON.stringify(session));
      pipeline.setex(tokenKey, ttl, session.id);
      pipeline.sadd(userSessionsKey, session.id);
      pipeline.expire(userSessionsKey, ttl);

      await pipeline.exec();
    } catch (error) {
      console.error("Failed to cache session:", error);
    }
  }

  async invalidate(sessionId: string): Promise<void> {
    const session = await this.getById(sessionId);

    await this.markRevoked(sessionId, session?.expiresAt);
    await this.clearValidated(sessionId);

    if (!session) {
      return;
    }

    const sessionKey = this.getSessionKey(sessionId);
    const tokenKey = this.getTokenKey(session.refreshTokenHash);
    const userSessionsKey = this.getUserSessionsKey(session.userId);

    await withRedisRetry(async () => {
      const pipeline = this.redis.pipeline();
      pipeline.del(sessionKey);
      pipeline.del(tokenKey);
      pipeline.srem(userSessionsKey, sessionId);
      await pipeline.exec();
    }, {
      attempts: REDIS_CACHE_RETRY_ATTEMPTS,
      delayMs: REDIS_CACHE_RETRY_DELAY_MS,
      operationName: "session cache invalidate",
    });
  }

  async invalidateByUserId(
    userId: string,
    excludeSessionId?: string
  ): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await this.redis.smembers(userSessionsKey).catch((error) => {
      console.error("Failed to list user sessions from cache:", error);
      return [] as string[];
    });

    if (sessionIds.length === 0) {
      return;
    }

    const idsToInvalidate = excludeSessionId
      ? sessionIds.filter((id) => id !== excludeSessionId)
      : sessionIds;

    if (idsToInvalidate.length === 0) {
      return;
    }

    for (const sessionId of idsToInvalidate) {
      await this.invalidate(sessionId);
    }
  }

  async updateAfterRefresh(
    session: CachedSession,
    previousRefreshTokenHash: string
  ): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(session.id);
      const oldTokenKey = this.getTokenKey(previousRefreshTokenHash);
      const newTokenKey = this.getTokenKey(session.refreshTokenHash);
      const userSessionsKey = this.getUserSessionsKey(session.userId);

      const ttl = Math.floor(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000
      );

      if (ttl <= 0) {
        await this.invalidate(session.id);
        return;
      }

      const supersededPayload = JSON.stringify({
        sessionId: session.id,
        userId: session.userId,
      });

      const pipeline = this.redis.pipeline();
      pipeline.setex(
        this.getSupersededKey(previousRefreshTokenHash),
        ttl,
        supersededPayload
      );
      pipeline.del(oldTokenKey);
      pipeline.setex(sessionKey, ttl, JSON.stringify(session));
      pipeline.setex(newTokenKey, ttl, session.id);
      pipeline.sadd(userSessionsKey, session.id);
      pipeline.expire(userSessionsKey, ttl);

      await pipeline.exec();
    } catch (error) {
      console.error("Failed to update session cache after refresh:", error);
    }
  }

  async updateLastSeen(sessionId: string): Promise<void> {
    try {
      const session = await this.getById(sessionId);

      if (!session) {
        return;
      }

      session.lastSeenAt = new Date().toISOString();
      await this.set(session);
    } catch (error) {
      console.error("Failed to update session last seen in cache:", error);
    }
  }

  /** Fail-closed: Redis errors assume revoked so caller revalidates from DB or rejects. */
  async isMarkedRevoked(sessionId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getRevokedKey(sessionId));
      return result === 1;
    } catch (error) {
      console.error("Failed to check session revoked marker:", error);
      return true;
    }
  }

  /** Fail-open to false forces DB revalidation when Redis is unavailable. */
  async isRecentlyValidated(sessionId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getValidatedKey(sessionId));
      return result === 1;
    } catch (error) {
      console.error("Failed to check session validation stamp:", error);
      return false;
    }
  }

  async markValidated(sessionId: string): Promise<void> {
    try {
      await this.redis.setex(
        this.getValidatedKey(sessionId),
        SESSION_STATUS_REVALIDATION_SECONDS,
        "1"
      );
    } catch (error) {
      console.error("Failed to mark session as validated:", error);
    }
  }
}

export const sessionCacheService = new SessionCacheService();
