import { beforeEach, describe, expect, it, mock } from "bun:test";
import { LogoutUseCase } from "./logout.use-case";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import { createMockSessionRepository } from "../../test-helpers/fixtures";

describe("LogoutUseCase", () => {
  let logoutUseCase: LogoutUseCase;
  let mockSessionRepository: SessionRepository;

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository();

    logoutUseCase = new LogoutUseCase({
      sessionRepository: mockSessionRepository,
    });
  });

  describe("revoke session", () => {
    it("should revoke session by ID", async () => {
      const sessionId = "session-123";

      await logoutUseCase.execute({ sessionId });

      expect(mockSessionRepository.revoke).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(sessionId);
    });

    it("should call repository revoke with correct session ID", async () => {
      await logoutUseCase.execute({ sessionId: "session-abc" });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith("session-abc");
    });

    it("should complete successfully when session is revoked", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: "session-123" })
      ).resolves.toBeUndefined();
    });
  });

  describe("already revoked session", () => {
    it("should not throw error when revoking already revoked session", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: "already-revoked-session" })
      ).resolves.toBeUndefined();
    });

    it("should call revoke even if session was already revoked", async () => {
      await logoutUseCase.execute({ sessionId: "already-revoked" });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith("already-revoked");
    });
  });

  describe("invalid session", () => {
    it("should not throw error when session does not exist", async () => {
      await expect(
        logoutUseCase.execute({ sessionId: "non-existent-session" })
      ).resolves.toBeUndefined();
    });

    it("should call revoke even if session does not exist", async () => {
      await logoutUseCase.execute({ sessionId: "non-existent" });

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("repository failures", () => {
    it("should propagate error when revoke fails", async () => {
      const repositoryError = new Error("Database error");
      mockSessionRepository.revoke = mock(async () => {
        throw repositoryError;
      });

      await expect(
        logoutUseCase.execute({ sessionId: "session-123" })
      ).rejects.toThrow("Database error");
    });

    it("should propagate database connection errors", async () => {
      mockSessionRepository.revoke = mock(async () => {
        throw new Error("Connection timeout");
      });

      await expect(
        logoutUseCase.execute({ sessionId: "session-123" })
      ).rejects.toThrow("Connection timeout");
    });
  });
});
