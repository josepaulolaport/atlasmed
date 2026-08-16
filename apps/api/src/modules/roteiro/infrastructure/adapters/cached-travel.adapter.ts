import type { Redis } from "ioredis";
import { redis } from "../../../../infrastructure/cache/redis.client";
import { logger } from "../../../../infrastructure/logging/logger";
import type { RoteiroPoint } from "../../application/interfaces/roteiro.repository.interface";
import type { TravelTimeSource } from "../../application/use-cases/generate-roteiro.use-case";

/**
 * Clinic-to-clinic drive times barely change; a rep's position changes
 * constantly. So pairs between two *fixed* places are cached for a month and
 * only the legs touching the rep are fetched fresh.
 *
 * Spec 0016 §7.4. Without it a rep regenerating through a morning pays for the
 * same matrix repeatedly, and the pairs they pay for are overwhelmingly the
 * ones that did not move.
 */
const PAIR_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Coordinates are rounded to ~11 m before keying.
 *
 * The same clinic arrives through several code paths — the candidate query, the
 * fixed-point lookup, a stored roteiro — and float identity does not survive
 * that. Rounding makes the cache actually hit; without it every lookup is a
 * miss and the cache is a slower way of calling Mapbox.
 */
function pointKey(point: RoteiroPoint): string {
  return `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
}

function pairKey(from: RoteiroPoint, to: RoteiroPoint): string {
  // Directional, never sorted: the Matrix is asymmetric — a probe returned
  // 927 s one way and 940 s back — because one-way systems are real.
  return `roteiro:travel:${pointKey(from)}>${pointKey(to)}`;
}

/**
 * Wraps a travel source with a Redis pair cache.
 *
 * The cache is a pure optimisation and never a correctness dependency: any
 * Redis failure is logged and ignored, falling through to the wrapped source,
 * which itself falls back to estimates. Three layers, each degrading rather
 * than failing, because the rep is in a car.
 */
export class CachedTravelTimeSource implements TravelTimeSource {
  constructor(
    private readonly inner: TravelTimeSource,
    private readonly client: Redis = redis,
  ) {}

  async durations(points: RoteiroPoint[]): Promise<number[][] | null> {
    if (points.length < 2) return null;

    const cached = await this.readCached(points);
    if (cached.complete) return cached.matrix;

    const fresh = await this.inner.durations(points);
    if (!fresh) {
      // Nothing new to be had. A partially-cached matrix is worse than none:
      // the gaps would silently read as zero-second drives.
      return null;
    }

    await this.writeCached(points, fresh);
    return fresh;
  }

  private async readCached(
    points: RoteiroPoint[],
  ): Promise<{ complete: boolean; matrix: number[][] }> {
    const keys: string[] = [];
    for (const from of points) {
      for (const to of points) {
        keys.push(pairKey(from, to));
      }
    }

    let values: (string | null)[];
    try {
      values = await this.client.mget(...keys);
    } catch (error) {
      logger.warn({ err: error }, "roteiro travel cache read failed; falling through");
      return { complete: false, matrix: [] };
    }

    const matrix: number[][] = [];
    let complete = true;
    let index = 0;
    for (let i = 0; i < points.length; i += 1) {
      const row: number[] = [];
      for (let j = 0; j < points.length; j += 1) {
        if (i === j) {
          row.push(0);
          index += 1;
          continue;
        }
        const raw = values[index];
        index += 1;
        const value = raw === null || raw === undefined ? Number.NaN : Number(raw);
        if (!Number.isFinite(value)) {
          complete = false;
          row.push(0);
        } else {
          row.push(value);
        }
      }
      matrix.push(row);
    }
    return { complete, matrix };
  }

  private async writeCached(points: RoteiroPoint[], matrix: number[][]): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      for (let i = 0; i < points.length; i += 1) {
        for (let j = 0; j < points.length; j += 1) {
          if (i === j) continue;
          const value = matrix[i]?.[j];
          if (typeof value !== "number" || !Number.isFinite(value)) continue;
          pipeline.set(pairKey(points[i]!, points[j]!), String(value), "EX", PAIR_TTL_SECONDS);
        }
      }
      await pipeline.exec();
    } catch (error) {
      logger.warn({ err: error }, "roteiro travel cache write failed; continuing");
    }
  }
}
