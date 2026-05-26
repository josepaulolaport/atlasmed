import type { Redis } from "ioredis";
import type { AccessGrantRecord } from "@atlasmed/access";
import { redis } from "../../../../infrastructure/cache/redis.client";

const CACHE_KEY_PREFIX = "permissions:user:";
const CACHE_TTL_SECONDS = 3600;

export class AccessGrantCacheService {
  private readonly redis: Redis;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  private getKey(userId: string): string {
    return `${CACHE_KEY_PREFIX}${userId}`;
  }

  async get(userId: string): Promise<AccessGrantRecord[] | null> {
    try {
      const data = await this.redis.get(this.getKey(userId));
      if (!data) {
        return null;
      }
      return JSON.parse(data) as AccessGrantRecord[];
    } catch (error) {
      console.error("Failed to get access grants from cache:", error);
      return null;
    }
  }

  async set(userId: string, grants: AccessGrantRecord[]): Promise<void> {
    try {
      await this.redis.setex(
        this.getKey(userId),
        CACHE_TTL_SECONDS,
        JSON.stringify(grants)
      );
    } catch (error) {
      console.error("Failed to set access grants in cache:", error);
    }
  }

  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(userId));
    } catch (error) {
      console.error("Failed to invalidate access grant cache:", error);
    }
  }
}

export const accessGrantCacheService = new AccessGrantCacheService();
