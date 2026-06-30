import type Redis from "ioredis";
import { generateRandomToken } from "../../../../shared/utils/generate-random-token";
import { environment } from "../../../../app/config/environment";
import { TokenInvalidError } from "../../../../shared/errors";

const PENDING_LOGIN_TTL_SECONDS = 5 * 60;
const MAX_TOTP_ATTEMPTS = 5;

export interface Pending2FALoginData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  acceptLanguage?: string;
}

interface Dependencies {
  redis: Redis;
}

export class Pending2FALoginService {
  constructor(private readonly deps: Dependencies) {}

  private pendingKey(pendingToken: string): string {
    return `${environment.REDIS_KEY_PREFIX}pending_2fa_login:${pendingToken}`;
  }

  private attemptsKey(pendingToken: string): string {
    return `${environment.REDIS_KEY_PREFIX}pending_2fa_attempts:${pendingToken}`;
  }

  async store(data: Pending2FALoginData): Promise<string> {
    const pendingToken = generateRandomToken();
    await this.deps.redis.setex(
      this.pendingKey(pendingToken),
      PENDING_LOGIN_TTL_SECONDS,
      JSON.stringify(data)
    );
    return pendingToken;
  }

  /** Read pending login without consuming (for TOTP verify before session create). */
  async get(pendingToken: string): Promise<Pending2FALoginData> {
    const raw = await this.deps.redis.get(this.pendingKey(pendingToken));

    if (!raw) {
      throw new TokenInvalidError();
    }

    return JSON.parse(raw) as Pending2FALoginData;
  }

  /**
   * Single-flight lock after successful TOTP verification.
   * Prevents concurrent verify requests from creating multiple sessions.
   */
  async acquireVerificationLock(pendingToken: string): Promise<boolean> {
    const result = await this.deps.redis.set(
      `${environment.REDIS_KEY_PREFIX}pending_2fa_lock:${pendingToken}`,
      "1",
      "EX",
      PENDING_LOGIN_TTL_SECONDS,
      "NX"
    );

    return result === "OK";
  }

  /** Atomically read and delete pending login (single-use on successful 2FA). */
  async consume(pendingToken: string): Promise<Pending2FALoginData> {
    const key = this.pendingKey(pendingToken);
    const raw = await this.deps.redis.getdel(key);

    if (!raw) {
      throw new TokenInvalidError();
    }

    await this.deps.redis.del(this.attemptsKey(pendingToken));
    return JSON.parse(raw) as Pending2FALoginData;
  }

  /**
   * Record a failed TOTP attempt. Returns false when max attempts exceeded
   * (pending token is invalidated).
   */
  async recordFailedAttempt(pendingToken: string): Promise<boolean> {
    const attemptsKey = this.attemptsKey(pendingToken);
    const attempts = await this.deps.redis.incr(attemptsKey);

    if (attempts === 1) {
      await this.deps.redis.expire(attemptsKey, PENDING_LOGIN_TTL_SECONDS);
    }

    if (attempts >= MAX_TOTP_ATTEMPTS) {
      await this.deps.redis.del(this.pendingKey(pendingToken));
      await this.deps.redis.del(attemptsKey);
      return false;
    }

    return true;
  }
}
