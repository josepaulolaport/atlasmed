import { beforeEach, describe, expect, it } from "bun:test";
import { Pending2FALoginService } from "./pending-2fa-login.service";
import { TokenInvalidError } from "../../../../shared/errors";

type StoredValue = {
  value: string;
  expiresAt?: number;
};

function createMockRedis() {
  const store = new Map<string, StoredValue>();

  return {
    store,
    setex: async (key: string, ttl: number, value: string) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
    },
    get: async (key: string) => store.get(key)?.value ?? null,
    getdel: async (key: string) => {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      store.delete(key);
      return entry.value;
    },
    incr: async (key: string) => {
      const current = Number(store.get(key)?.value ?? "0");
      const next = current + 1;
      store.set(key, { value: String(next) });
      return next;
    },
    expire: async () => 1,
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) {
          removed += 1;
        }
      }
      return removed;
    },
    set: async (
      key: string,
      value: string,
      _ex?: string,
      _ttl?: number,
      nx?: string
    ) => {
      if (nx === "NX" && store.has(key)) {
        return null;
      }
      store.set(key, { value });
      return "OK";
    },
  };
}

describe("Pending2FALoginService", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let service: Pending2FALoginService;

  beforeEach(() => {
    redis = createMockRedis();
    service = new Pending2FALoginService({ redis: redis as never });
  });

  it("stores and consumes pending login atomically", async () => {
    const pendingToken = await service.store({
      userId: "user-123",
      ipAddress: "10.0.0.1",
    });

    const pending = await service.get(pendingToken);
    expect(pending.userId).toBe("user-123");

    const consumed = await service.consume(pendingToken);
    expect(consumed.userId).toBe("user-123");

    await expect(service.get(pendingToken)).rejects.toThrow(TokenInvalidError);
  });

  it("invalidates pending token after max failed attempts", async () => {
    const pendingToken = await service.store({ userId: "user-123" });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const remaining = await service.recordFailedAttempt(pendingToken);
      expect(remaining).toBe(true);
    }

    const remaining = await service.recordFailedAttempt(pendingToken);
    expect(remaining).toBe(false);
    await expect(service.get(pendingToken)).rejects.toThrow(TokenInvalidError);
  });

  it("acquireVerificationLock allows only one winner", async () => {
    const pendingToken = await service.store({ userId: "user-123" });

    expect(await service.acquireVerificationLock(pendingToken)).toBe(true);
    expect(await service.acquireVerificationLock(pendingToken)).toBe(false);
  });
});
