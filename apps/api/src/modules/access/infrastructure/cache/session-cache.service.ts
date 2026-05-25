import type { Redis } from "ioredis";
import { redis } from "../../../../infrastructure/cache/redis.client";
import type { ISessionCache, CachedSession } from "../../application/interfaces/session-cache.interface";

export class SessionCacheService implements ISessionCache {
  private readonly redis: Redis;
  private readonly sessionKeyPrefix = "session:id:";
  private readonly tokenKeyPrefix = "session:token:";
  private readonly userSessionsKeyPrefix = "session:user:";
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
    try {
      const session = await this.getById(sessionId);

      if (!session) {
        return;
      }

      const sessionKey = this.getSessionKey(sessionId);
      const tokenKey = this.getTokenKey(session.refreshTokenHash);
      const userSessionsKey = this.getUserSessionsKey(session.userId);

      const pipeline = this.redis.pipeline();
      pipeline.del(sessionKey);
      pipeline.del(tokenKey);
      pipeline.srem(userSessionsKey, sessionId);

      await pipeline.exec();
    } catch (error) {
      console.error("Failed to invalidate session cache:", error);
    }
  }

  async invalidateByUserId(
    userId: string,
    excludeSessionId?: string
  ): Promise<void> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.smembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return;
      }

      const idsToInvalidate = excludeSessionId
        ? sessionIds.filter((id) => id !== excludeSessionId)
        : sessionIds;

      if (idsToInvalidate.length === 0) {
        return;
      }

      const pipeline = this.redis.pipeline();

      for (const sessionId of idsToInvalidate) {
        const session = await this.getById(sessionId);
        if (session) {
          pipeline.del(this.getSessionKey(sessionId));
          pipeline.del(this.getTokenKey(session.refreshTokenHash));
          pipeline.srem(userSessionsKey, sessionId);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error("Failed to invalidate user sessions cache:", error);
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
}

export const sessionCacheService = new SessionCacheService();
