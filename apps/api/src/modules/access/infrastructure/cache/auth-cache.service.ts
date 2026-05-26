import type { Redis } from "ioredis";
import { redis } from "../../../../infrastructure/cache/redis.client";
import {
  AUTH_STATUS_REVALIDATION_SECONDS,
  REDIS_CACHE_RETRY_ATTEMPTS,
  REDIS_CACHE_RETRY_DELAY_MS,
} from "../../application/constants/cache.constants";
import type { IAuthCache, CachedAuthContext } from "../../application/interfaces/auth-cache.interface";
import { withRedisRetry } from "../../../../shared/utils/redis-retry";

export class AuthCacheService implements IAuthCache {
  private readonly redis: Redis;
  private readonly keyPrefix = "auth:user:";
  private readonly validatedKeyPrefix = "auth:validated:";
  private readonly ttl = 3600;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }

  private getValidatedKey(userId: string): string {
    return `${this.validatedKeyPrefix}${userId}`;
  }

  async get(userId: string): Promise<CachedAuthContext | null> {
    try {
      const data = await this.redis.get(this.getKey(userId));

      if (!data) {
        return null;
      }

      return JSON.parse(data) as CachedAuthContext;
    } catch (error) {
      console.error("Failed to get auth context from cache:", error);
      return null;
    }
  }

  async set(userId: string, context: CachedAuthContext): Promise<void> {
    try {
      await this.redis.setex(
        this.getKey(userId),
        this.ttl,
        JSON.stringify(context)
      );
    } catch (error) {
      console.error("Failed to set auth context in cache:", error);
    }
  }

  async invalidate(userId: string): Promise<void> {
    await withRedisRetry(
      () => this.redis.del(this.getValidatedKey(userId), this.getKey(userId)),
      {
        attempts: REDIS_CACHE_RETRY_ATTEMPTS,
        delayMs: REDIS_CACHE_RETRY_DELAY_MS,
        operationName: "auth cache invalidate",
      }
    );
  }

  async invalidateMultiple(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const keys = userIds.flatMap((id) => [
      this.getValidatedKey(id),
      this.getKey(id),
    ]);

    await withRedisRetry(() => this.redis.del(...keys), {
      attempts: REDIS_CACHE_RETRY_ATTEMPTS,
      delayMs: REDIS_CACHE_RETRY_DELAY_MS,
      operationName: "auth cache invalidateMultiple",
    });
  }

  async exists(userId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getKey(userId));
      return result === 1;
    } catch (error) {
      console.error("Failed to check auth context existence:", error);
      return false;
    }
  }

  async isRecentlyValidated(userId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getValidatedKey(userId));
      return result === 1;
    } catch (error) {
      console.error("Failed to check auth validation stamp:", error);
      return false;
    }
  }

  async markValidated(userId: string): Promise<void> {
    try {
      await this.redis.setex(
        this.getValidatedKey(userId),
        AUTH_STATUS_REVALIDATION_SECONDS,
        "1"
      );
    } catch (error) {
      console.error("Failed to mark auth context as validated:", error);
    }
  }
}

export const authCacheService = new AuthCacheService();
