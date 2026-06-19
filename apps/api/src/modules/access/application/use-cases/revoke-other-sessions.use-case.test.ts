import { beforeEach, describe, expect, it, mock } from "bun:test";
import { RevokeOtherSessionsUseCase } from "./revoke-other-sessions.use-case";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockSessionRepository,
  createMockSessionCache,
} from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

describe("RevokeOtherSessionsUseCase", () => {
  let useCase: RevokeOtherSessionsUseCase;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  const currentSession = {
    id: "session-current",
    userId: "user-123",
    refreshTokenHash: "hash",
    ipAddress: "192.168.1.1",
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
      findById: mock(async (id: string) =>
        id === "session-current" ? currentSession : null
      ),
      revokeAllExceptDevice: mock(async () => ["session-other-1", "session-other-2"]),
    });
    mockSessionCache = createMockSessionCache({
      invalidate: mock(async () => {}),
    });

    useCase = new RevokeOtherSessionsUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
      auditLog: mockAuditLog,
    });
  });

  it("should revoke other sessions and audit each revocation", async () => {
    const result = await useCase.execute({
      userId: "user-123",
      currentSessionId: "session-current",
    });

    expect(result).toEqual({ revokedCount: 2 });
    expect(mockSessionRepository.revokeAllExceptDevice).toHaveBeenCalledWith(
      "user-123",
      {
        id: currentSession.id,
        deviceFingerprint: currentSession.deviceFingerprint,
        userAgent: currentSession.userAgent,
        deviceType: currentSession.deviceType,
      },
      { reason: "Logout from other devices" }
    );
    expect(mockSessionCache.invalidate).toHaveBeenCalledTimes(2);
    expect(mockAuditLog.logSessionRevoke).toHaveBeenCalledTimes(2);
  });

  it("should return zero when current session does not belong to user", async () => {
    mockSessionRepository.findById = mock(async () => ({
      ...currentSession,
      userId: "other-user",
    }));

    const result = await useCase.execute({
      userId: "user-123",
      currentSessionId: "session-current",
    });

    expect(result).toEqual({ revokedCount: 0 });
    expect(mockSessionRepository.revokeAllExceptDevice).not.toHaveBeenCalled();
  });

  it("should return zero when current session not found", async () => {
    mockSessionRepository.findById = mock(async () => null);

    const result = await useCase.execute({
      userId: "user-123",
      currentSessionId: "missing",
    });

    expect(result).toEqual({ revokedCount: 0 });
    expect(mockSessionRepository.revokeAllExceptDevice).not.toHaveBeenCalled();
  });
});
