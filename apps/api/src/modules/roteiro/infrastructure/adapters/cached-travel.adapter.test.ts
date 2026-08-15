import { describe, expect, it } from "bun:test";
import type { Redis } from "ioredis";
import { CachedTravelTimeSource } from "./cached-travel.adapter";
import type { TravelTimeSource } from "../../application/use-cases/generate-roteiro.use-case";

const A = { lat: -23.5505, lng: -46.6333 };
const B = { lat: -23.5701, lng: -46.5882 };

class FakeRedis {
  store = new Map<string, string>();
  mgetCalls = 0;
  fail = false;
  async mget(...keys: string[]) {
    this.mgetCalls += 1;
    if (this.fail) throw new Error("redis down");
    return keys.map((k) => this.store.get(k) ?? null);
  }
  pipeline() {
    const ops: Array<[string, string]> = [];
    const self = this;
    return {
      set(key: string, value: string) {
        ops.push([key, value]);
        return this;
      },
      async exec() {
        if (self.fail) throw new Error("redis down");
        for (const [k, v] of ops) self.store.set(k, v);
        return [];
      },
    };
  }
}

function inner(matrix: number[][] | null): TravelTimeSource & { calls: number } {
  return {
    calls: 0,
    async durations() {
      (this as { calls: number }).calls += 1;
      return matrix;
    },
  };
}

describe("CachedTravelTimeSource", () => {
  it("fetches on a cold cache and serves the second call from it", async () => {
    const redis = new FakeRedis();
    const source = inner([
      [0, 900],
      [940, 0],
    ]);
    const cached = new CachedTravelTimeSource(source, redis as unknown as Redis);

    const first = await cached.durations([A, B]);
    const second = await cached.durations([A, B]);

    expect(first).toEqual([
      [0, 900],
      [940, 0],
    ]);
    expect(second).toEqual([
      [0, 900],
      [940, 0],
    ]);
    expect(source.calls).toBe(1);
  });

  it("keeps direction, because the matrix is asymmetric", async () => {
    const redis = new FakeRedis();
    const cached = new CachedTravelTimeSource(
      inner([
        [0, 900],
        [940, 0],
      ]),
      redis as unknown as Redis,
    );

    await cached.durations([A, B]);
    const again = await cached.durations([A, B]);

    // 900 out, 940 back — a sorted key would have collapsed these.
    expect(again?.[0]?.[1]).toBe(900);
    expect(again?.[1]?.[0]).toBe(940);
  });

  it("refetches rather than serving a matrix with holes in it", async () => {
    const redis = new FakeRedis();
    const source = inner([
      [0, 900],
      [940, 0],
    ]);
    const cached = new CachedTravelTimeSource(source, redis as unknown as Redis);
    await cached.durations([A, B]);

    // Lose one direction, as an eviction would.
    redis.store.delete([...redis.store.keys()][0]!);
    await cached.durations([A, B]);

    // A partial hit must not be served: the gaps would read as zero-second
    // drives and the plan would look wonderful and be wrong.
    expect(source.calls).toBe(2);
  });

  it("falls through when Redis is unavailable rather than failing", async () => {
    const redis = new FakeRedis();
    redis.fail = true;
    const source = inner([
      [0, 900],
      [940, 0],
    ]);
    const cached = new CachedTravelTimeSource(source, redis as unknown as Redis);

    const result = await cached.durations([A, B]);

    expect(result).toEqual([
      [0, 900],
      [940, 0],
    ]);
    expect(source.calls).toBe(1);
  });

  it("returns null when the wrapped source has nothing either", async () => {
    const redis = new FakeRedis();
    const cached = new CachedTravelTimeSource(inner(null), redis as unknown as Redis);

    expect(await cached.durations([A, B])).toBeNull();
  });
});
