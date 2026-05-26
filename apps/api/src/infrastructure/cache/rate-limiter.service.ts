import type { Redis } from "ioredis";
import { redis } from "./redis.client";

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blockedUntil?: Date;
}

export class RateLimiterService {
  private readonly redis: Redis;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  private getKey(namespace: string, identifier: string): string {
    return `ratelimit:${namespace}:${identifier}`;
  }

  private getBlockKey(namespace: string, identifier: string): string {
    return `ratelimit:block:${namespace}:${identifier}`;
  }

  async check(
    namespace: string,
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.getKey(namespace, identifier);
    const blockKey = this.getBlockKey(namespace, identifier);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      const isBlocked = await this.redis.exists(blockKey);

      if (isBlocked) {
        const ttl = await this.redis.ttl(blockKey);
        const blockedUntil = new Date(now + ttl * 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedUntil,
          blockedUntil,
        };
      }

      await this.redis.zremrangebyscore(key, 0, windowStart);

      const currentCount = await this.redis.zcard(key);

      if (currentCount >= config.maxAttempts) {
        if (config.blockDurationMs) {
          await this.redis.setex(
            blockKey,
            Math.floor(config.blockDurationMs / 1000),
            "1"
          );

          return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(now + config.blockDurationMs),
            blockedUntil: new Date(now + config.blockDurationMs),
          };
        }

        const oldestEntry = await this.redis.zrange(key, 0, 0, "WITHSCORES");
        const resetAt = new Date(Number(oldestEntry[1]) + config.windowMs);

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      await this.redis.zadd(key, now, `${now}:${Math.random()}`);
      await this.redis.expire(key, Math.ceil(config.windowMs / 1000));

      const remaining = config.maxAttempts - (currentCount + 1);
      const resetAt = new Date(now + config.windowMs);

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    } catch (error) {
      // Fail open: allow the request when Redis is unavailable
      console.error("Rate limit check failed:", error);

      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetAt: new Date(now + config.windowMs),
      };
    }
  }

  async reset(namespace: string, identifier: string): Promise<void> {
    try {
      const key = this.getKey(namespace, identifier);
      const blockKey = this.getBlockKey(namespace, identifier);

      await Promise.all([this.redis.del(key), this.redis.del(blockKey)]);
    } catch (error) {
      console.error("Failed to reset rate limit:", error);
    }
  }

  async getRemainingAttempts(
    namespace: string,
    identifier: string,
    maxAttempts: number
  ): Promise<number> {
    try {
      const key = this.getKey(namespace, identifier);
      const currentCount = await this.redis.zcard(key);

      return Math.max(0, maxAttempts - currentCount);
    } catch (error) {
      console.error("Failed to get remaining attempts:", error);
      return maxAttempts;
    }
  }
}

export const rateLimiterService = new RateLimiterService();
