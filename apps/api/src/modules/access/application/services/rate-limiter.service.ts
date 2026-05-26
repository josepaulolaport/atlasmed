import type Redis from "ioredis";
import { TooManyLoginAttemptsError } from "../../../../shared/errors";

interface Dependencies {
  redis: Redis;
}

export class RateLimiterService {
  private readonly ATTEMPT_WINDOW = 900; // 15 minutes in seconds
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 900; // 15 minutes lockout

  constructor(private readonly deps: Dependencies) {}

  async checkLoginAttempts(identifier: string): Promise<void> {
    const lockKey = `account_locked:${identifier}`;
    const attemptKey = `login_attempts:${identifier}`;

    // Check if account is locked
    const isLocked = await this.deps.redis.get(lockKey);
    if (isLocked) {
      const ttl = await this.deps.redis.ttl(lockKey);
      throw new TooManyLoginAttemptsError(Math.max(ttl, 1) * 1000);
    }

    // Check current attempts
    const attempts = await this.deps.redis.get(attemptKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= this.MAX_ATTEMPTS) {
      // Lock the account
      await this.deps.redis.setex(lockKey, this.LOCKOUT_DURATION, "1");
      await this.deps.redis.del(attemptKey);
      throw new TooManyLoginAttemptsError(this.LOCKOUT_DURATION * 1000);
    }
  }

  async recordFailedAttempt(identifier: string): Promise<void> {
    const attemptKey = `login_attempts:${identifier}`;
    const current = await this.deps.redis.incr(attemptKey);

    // Set expiry on first attempt
    if (current === 1) {
      await this.deps.redis.expire(attemptKey, this.ATTEMPT_WINDOW);
    }

    const remaining = this.MAX_ATTEMPTS - current;
    if (remaining > 0 && remaining <= 2) {
      console.warn(`User ${identifier} has ${remaining} login attempt(s) remaining`);
    }
  }

  async clearAttempts(identifier: string): Promise<void> {
    const attemptKey = `login_attempts:${identifier}`;
    await this.deps.redis.del(attemptKey);
  }

  async getRemainingAttempts(identifier: string): Promise<number> {
    const attemptKey = `login_attempts:${identifier}`;
    const attempts = await this.deps.redis.get(attemptKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;
    return Math.max(0, this.MAX_ATTEMPTS - attemptCount);
  }
}
