import { rateLimiterService } from "../../../../infrastructure/cache/rate-limiter.service";
import type { GenerationQuota } from "../../application/use-cases/generate-roteiro.use-case";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-agent daily generation ceiling, on the shared rate limiter.
 *
 * Keyed by agent *and* day so the window resets on their calendar day rather
 * than a rolling 24 hours — a rep who exhausted the limit at 16:00 should have
 * it back the next morning, not at 16:00 tomorrow.
 *
 * `failClosed: false` deliberately: if Redis is unavailable the rep still gets
 * their roteiro. The limit exists to bound a bill, not to protect correctness,
 * and refusing to plan someone's day because a cache is down trades a small
 * cost for a total outage.
 */
export class RedisGenerationQuota implements GenerationQuota {
  async consume(input: { userId: number; day: string; max: number }): Promise<boolean> {
    const result = await rateLimiterService.check(
      "roteiro-generate",
      `${input.userId}:${input.day}`,
      { maxAttempts: input.max, windowMs: DAY_MS, failClosed: false },
    );
    return result.allowed;
  }
}
