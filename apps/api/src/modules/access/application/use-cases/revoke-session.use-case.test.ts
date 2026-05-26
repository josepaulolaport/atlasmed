import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

import { RevokeSessionUseCase } from "./revoke-session.use-case";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
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

  const targetSession = {
    id: "session-target",
    userId: "user-123",
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
    id: "session-current",
    userId: "user-123",
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
    mockSessionRepository = createMockSessionRepository({
      findById: mock(async (id: string) => {
        if (id === "session-target") return targetSession;
        if (id === "session-current") return currentSession;
        return null;
      }),
      revokeAllActiveForDevice: mock(async () => ["session-target", "session-target-2"]),
    });

    mockSessionCache = createMockSessionCache({
      invalidate: mock(async () => {}),
    });

    useCase = new RevokeSessionUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
    });
  });

  it("should audit each revoked session on success", async () => {
    const result = await useCase.execute({
      sessionId: "session-target",
      userId: "user-123",
      currentSessionId: "session-current",
    });

    expect(result).toEqual({ success: true });
    expect(auditLogService.logSessionRevoke).toHaveBeenCalledTimes(2);
    expect(auditLogService.logSessionRevoke).toHaveBeenCalledWith({
      userId: "user-123",
      sessionId: "session-target",
      reason: "Revoked by user",
      revokedByUserId: "user-123",
    });
    expect(auditLogService.logSessionRevoke).toHaveBeenCalledWith({
      userId: "user-123",
      sessionId: "session-target-2",
      reason: "Revoked by user",
      revokedByUserId: "user-123",
    });
  });
});
