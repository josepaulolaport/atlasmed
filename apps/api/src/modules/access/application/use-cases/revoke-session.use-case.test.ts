import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

import { RevokeSessionUseCase } from "./revoke-session.use-case";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockSessionRepository,
  createMockSessionCache,
} from "../../test-helpers/fixtures";

describe("RevokeSessionUseCase", () => {
  let useCase: RevokeSessionUseCase;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;

  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  const targetSession = {
    id: 2,
    userId: 123,
    refreshTokenHash: "hash",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0 (iPhone)",
    deviceFingerprint: "fp-target",
    deviceType: "mobile",
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
  };

  const currentSession = {
    id: 1,
    userId: 123,
    refreshTokenHash: "hash-current",
    ipAddress: "192.168.1.2",
    userAgent: "Mozilla/5.0 (Macintosh)",
    deviceFingerprint: "fp-current",
    deviceType: "desktop",
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    lastSeenAt: new Date(),
    revokedAt: null,
    revokedReason: null,
  };

  beforeEach(() => {
    mockAuditLog = createMockAuditLogService();
    mockSessionRepository = createMockSessionRepository({
      findById: mock(async (id: number) => {
        if (id === 2) return targetSession;
        if (id === 1) return currentSession;
        return null;
      }) as any,
      revokeAllActiveForDevice: mock(async () => [2, 3]),
    });

    mockSessionCache = createMockSessionCache({
      invalidate: mock(async () => {}),
    });

    useCase = new RevokeSessionUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
      auditLog: mockAuditLog,
    });
  });

  it("should audit each revoked session on success", async () => {
    const result = await useCase.execute({
      sessionId: 2,
      userId: 123,
      currentSessionId: 1,
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditLog.logSessionRevoke).toHaveBeenCalledTimes(2);
    expect(mockAuditLog.logSessionRevoke).toHaveBeenCalledWith({
      userId: 123,
      sessionId: 2,
      reason: "Revoked by user",
      revokedByUserId: 123,
    });
    expect(mockAuditLog.logSessionRevoke).toHaveBeenCalledWith({
      userId: 123,
      sessionId: 3,
      reason: "Revoked by user",
      revokedByUserId: 123,
    });
  });
});
