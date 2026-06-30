import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Verify2FALoginUseCase } from "./verify-2fa-login.use-case";
import { TokenService } from "../services/token.service";
import { Pending2FALoginService } from "../services/pending-2fa-login.service";
import {
  createMockUserRepository,
  createMockSessionCache,
} from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";
import { TokenInvalidError } from "../../../../shared/errors";

describe("Verify2FALoginUseCase race handling", () => {
  let createCalls = 0;

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    status: "ACTIVE",
    tokenVersion: 1,
    twoFactorEnabled: true,
    twoFactorSecret: "encrypted-secret",
    role: {
      id: "role-123",
      name: "USER",
    },
  };

  const mockSession = {
    id: "session-123",
    userId: "user-123",
    refreshToken: "refresh-token",
    refreshTokenHash: "refresh-hash",
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    lastSeenAt: new Date(),
    createdAt: new Date(),
  };

  let useCase: Verify2FALoginUseCase;
  let pendingService: Pending2FALoginService;

  beforeEach(() => {
    createCalls = 0;

    const redisStore = new Map<string, string>();
    const redis = {
      setex: async (key: string, _ttl: number, value: string) => {
        redisStore.set(key, value);
      },
      get: async (key: string) => redisStore.get(key) ?? null,
      getdel: async (key: string) => {
        const value = redisStore.get(key) ?? null;
        redisStore.delete(key);
        return value;
      },
      incr: async (key: string) => {
        const next = Number(redisStore.get(key) ?? "0") + 1;
        redisStore.set(key, String(next));
        return next;
      },
      expire: async () => 1,
      del: async (...keys: string[]) => {
        for (const key of keys) {
          redisStore.delete(key);
        }
        return keys.length;
      },
      set: async (key: string, value: string, _ex?: string, _ttl?: number, nx?: string) => {
        if (nx === "NX" && redisStore.has(key)) {
          return null;
        }
        redisStore.set(key, value);
        return "OK";
      },
    };

    pendingService = new Pending2FALoginService({ redis: redis as never });

    useCase = new Verify2FALoginUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => mockUser),
        updateLastLogin: mock(async () => {}),
      }),
      sessionCache: createMockSessionCache(),
      twoFactorService: {
        decryptSecret: mock(() => "plain-secret"),
        verifyTotp: mock(async () => true),
      } as never,
      pending2faLoginService: pendingService,
      tokenService: new TokenService(),
      sessionService: {
        create: mock(async () => {
          createCalls += 1;
          return mockSession;
        }),
      } as never,
      auditLog: createMockAuditLogService(),
      metrics: createMockMetricsService(),
    });
  });

  it("creates at most one session for concurrent successful verifications", async () => {
    const pendingToken = await pendingService.store({
      userId: "user-123",
      ipAddress: "192.168.1.1",
    });

    const results = await Promise.allSettled([
      useCase.execute({ pendingToken, code: "123456" }),
      useCase.execute({ pendingToken, code: "123456" }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(createCalls).toBe(1);
    expect(
      rejected.some(
        (result) =>
          result.status === "rejected" && result.reason instanceof TokenInvalidError
      )
    ).toBe(true);
  });
});
