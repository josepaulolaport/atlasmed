import Redis from "ioredis";
import { logger } from "../logging/logger";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
    return targetErrors.some((targetError) => err.message.includes(targetError));
  },
});

redis.on("error", (err) => {
  logger.error("Redis client error", err);
});

redis.on("connect", () => {
  logger.info("Redis client connected");
});
