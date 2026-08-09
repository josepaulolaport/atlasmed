import type { ScopeContext } from "@atlasmed/access";
import { logger } from "../../../../infrastructure/logging/logger";
import { redis } from "../../../../infrastructure/cache/redis.client";

const CACHE_TTL_SECONDS = 900;
const CACHE_KEY_PREFIX = "scope:user:";

export class ScopeCacheService {
  private getCacheKey(userId: number): string {
    return `${CACHE_KEY_PREFIX}${userId}`;
  }

  async get(userId: number): Promise<ScopeContext | null> {
    try {
      const cached = await redis.get(this.getCacheKey(userId));

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as ScopeContext;
    } catch (error) {
      logger.error("Failed to get scope from cache", error);
      return null;
    }
  }

  async set(userId: number, scope: ScopeContext): Promise<void> {
    try {
      await redis.setex(this.getCacheKey(userId), CACHE_TTL_SECONDS, JSON.stringify(scope));
    } catch (error) {
      logger.error("Failed to cache scope", error);
    }
  }

  async invalidate(userId: number): Promise<void> {
    try {
      await redis.del(this.getCacheKey(userId));
    } catch (error) {
      logger.error("Failed to invalidate scope cache", error);
    }
  }

  async invalidateMany(userIds: number[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      const pipeline = redis.pipeline();

      for (const userId of userIds) {
        pipeline.del(this.getCacheKey(userId));
      }

      await pipeline.exec();
    } catch (error) {
      logger.error("Failed to invalidate scope cache for multiple users", error);
    }
  }
}

export const scopeCacheService = new ScopeCacheService();
