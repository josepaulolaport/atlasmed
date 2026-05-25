import type { Redis } from "ioredis";
import { redis } from "../../../../infrastructure/cache/redis.client";
import type { IAuthCache, CachedAuthContext } from "../../application/interfaces/auth-cache.interface";

export class AuthCacheService implements IAuthCache {
  private readonly redis: Redis;
  private readonly keyPrefix = "auth:user:";
  private readonly ttl = 3600;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
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
    try {
      await this.redis.del(this.getKey(userId));
    } catch (error) {
      console.error("Failed to invalidate auth context:", error);
    }
  }

  async invalidateMultiple(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      const keys = userIds.map((id) => this.getKey(id));
      await this.redis.del(...keys);
    } catch (error) {
      console.error("Failed to invalidate multiple auth contexts:", error);
    }
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
}

export const authCacheService = new AuthCacheService();
