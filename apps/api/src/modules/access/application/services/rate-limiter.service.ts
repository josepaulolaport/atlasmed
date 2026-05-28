import type Redis from "ioredis";
import { TooManyLoginAttemptsError } from "../../../../shared/errors";
import { environment } from "../../../../app/config/environment";

interface Dependencies {
  redis: Redis;
}

export class RateLimiterService {
  private readonly attemptWindowSeconds: number;
  private readonly maxAttempts: number;
  private readonly lockoutDurationSeconds: number;

  private readonly keyPrefix: string;

  constructor(private readonly deps: Dependencies) {
    this.maxAttempts = environment.MAX_LOGIN_ATTEMPTS;
    this.lockoutDurationSeconds = environment.LOGIN_LOCKOUT_MINUTES * 60;
    this.attemptWindowSeconds = this.lockoutDurationSeconds;
    this.keyPrefix = environment.REDIS_KEY_PREFIX;
  }

  private lockKey(identifier: string): string {
    return `${this.keyPrefix}account_locked:${identifier}`;
  }

  private attemptKey(identifier: string): string {
    return `${this.keyPrefix}login_attempts:${identifier}`;
  }

  async checkLoginAttempts(identifier: string): Promise<void> {
    const lockKey = this.lockKey(identifier);
    const attemptKey = this.attemptKey(identifier);

    // Check if account is locked
    const isLocked = await this.deps.redis.get(lockKey);
    if (isLocked) {
      const ttl = await this.deps.redis.ttl(lockKey);
      throw new TooManyLoginAttemptsError(Math.max(ttl, 1) * 1000);
    }

    // Check current attempts
    const attempts = await this.deps.redis.get(attemptKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= this.maxAttempts) {
      await this.deps.redis.setex(lockKey, this.lockoutDurationSeconds, "1");
      await this.deps.redis.del(attemptKey);
      throw new TooManyLoginAttemptsError(this.lockoutDurationSeconds * 1000);
    }
  }

  async recordFailedAttempt(identifier: string): Promise<void> {
    const attemptKey = this.attemptKey(identifier);
    const current = await this.deps.redis.incr(attemptKey);

    // Set expiry on first attempt
    if (current === 1) {
      await this.deps.redis.expire(attemptKey, this.attemptWindowSeconds);
    }

    const remaining = this.maxAttempts - current;
    if (remaining > 0 && remaining <= 2) {
      console.warn(`User ${identifier} has ${remaining} login attempt(s) remaining`);
    }
  }

  async clearAttempts(identifier: string): Promise<void> {
    const attemptKey = this.attemptKey(identifier);
    await this.deps.redis.del(attemptKey);
  }

  async getRemainingAttempts(identifier: string): Promise<number> {
    const attemptKey = this.attemptKey(identifier);
    const attempts = await this.deps.redis.get(attemptKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;
    return Math.max(0, this.maxAttempts - attemptCount);
  }
}
