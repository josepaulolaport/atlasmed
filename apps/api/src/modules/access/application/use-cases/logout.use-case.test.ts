import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";

import { LogoutUseCase } from "./logout.use-case";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import {
  createMockSessionRepository,
  createMockSessionCache,
  createMockAuthCache,
} from "../../test-helpers/fixtures";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";

describe("LogoutUseCase", () => {
  let logoutUseCase: LogoutUseCase;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;
  let mockAuthCache: IAuthCache;

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository();
    mockSessionCache = createMockSessionCache();
    mockAuthCache = createMockAuthCache();

    logoutUseCase = new LogoutUseCase({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
      authCache: mockAuthCache,
      auditLog: createMockAuditLogService(),
    });
  });

  describe("revoke session", () => {
    it("should revoke session by ID", async () => {
      const sessionId = 1;

      await logoutUseCase.execute({ sessionId, userId: 123 });

      expect(mockSessionRepository.revoke).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(sessionId);
      expect(mockSessionCache.invalidate).toHaveBeenCalledWith(sessionId);
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith(123);
    });

    it("should call repository revoke with correct session ID", async () => {
      await logoutUseCase.execute({ sessionId: 2, userId: 123 });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(2);
    });

    it("should complete successfully when session is revoked", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: 1, userId: 123 })
      ).resolves.toBeUndefined();
    });
  });

  describe("already revoked session", () => {
    it("should not throw error when revoking already revoked session", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: 2, userId: 123 })
      ).resolves.toBeUndefined();
    });

    it("should call revoke even if session was already revoked", async () => {
      await logoutUseCase.execute({ sessionId: 2, userId: 123 });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(2);
    });
  });

  describe("invalid session", () => {
    it("should not throw error when session does not exist", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: 999, userId: 123 })
      ).resolves.toBeUndefined();
    });

    it("should call revoke even if session does not exist", async () => {
      await logoutUseCase.execute({ sessionId: 999, userId: 123 });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(999);
    });
  });

  describe("repository failures", () => {
    it("should propagate error when revoke fails", async () => {
      const repositoryError = new Error("Database error");
      mockSessionRepository.revoke = mock(async () => {
        throw repositoryError;
      });

      await expect(
        logoutUseCase.execute({ sessionId: 1, userId: 123 })
      ).rejects.toThrow("Database error");
    });

    it("should propagate database connection errors", async () => {
      mockSessionRepository.revoke = mock(async () => {
        throw new Error("Connection timeout");
      });

      await expect(
        logoutUseCase.execute({ sessionId: 1, userId: 123 })
      ).rejects.toThrow("Connection timeout");
    });
  });
});
