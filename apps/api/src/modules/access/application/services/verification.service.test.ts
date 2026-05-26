import { beforeEach, describe, expect, it, mock } from "bun:test";

import { TokenInvalidError } from "../../../../shared/errors";
import { VerificationService } from "./verification.service";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import {
  createMockUserRepository,
  createMockVerificationTokenRepository,
} from "../../test-helpers/repository-mocks";

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService(),
}));

mock.module("../../../../infrastructure/jobs/notification.queue", () => ({
  notificationQueue: {
    sendEmail: mock(() => Promise.resolve()),
    sendSms: mock(() => Promise.resolve()),
  },
}));

mock.module("../../../../shared/utils/generate-random-token", () => ({
  generateRandomToken: mock(() => "raw-token"),
}));

mock.module("../../../../shared/utils/hash-token", () => ({
  hashToken: mock((token: string) => `hash-${token}`),
}));

describe("VerificationService", () => {
  let verificationTokenRepository: ReturnType<typeof createMockVerificationTokenRepository>;
  let userRepository: ReturnType<typeof createMockUserRepository>;
  let service: VerificationService;

  beforeEach(() => {
    verificationTokenRepository = createMockVerificationTokenRepository();
    userRepository = createMockUserRepository();
    service = new VerificationService({
      verificationTokenRepository,
      userRepository,
    });
  });

  describe("verifyEmail", () => {
    it("should call repositories instead of prisma", async () => {
      verificationTokenRepository.findValidToken = mock(() =>
        Promise.resolve({ id: "token-123", newValue: null })
      );
      userRepository.findEmailVerificationState = mock(() =>
        Promise.resolve({ email: "user@example.com", emailVerified: true })
      );

      await service.verifyEmail({ userId: "user-123", token: "raw-token" });

      expect(verificationTokenRepository.findValidToken).toHaveBeenCalledWith({
        tokenHash: "hash-raw-token",
        userId: "user-123",
        type: "EMAIL_VERIFICATION",
      });
      expect(verificationTokenRepository.markVerified).toHaveBeenCalledWith("token-123");
      expect(userRepository.markEmailVerified).toHaveBeenCalledWith("user-123");
      expect(userRepository.findEmailVerificationState).toHaveBeenCalledWith("user-123");
    });

    it("should throw TokenInvalidError for invalid token", async () => {
      verificationTokenRepository.findValidToken = mock(() => Promise.resolve(null));

      await expect(
        service.verifyEmail({ userId: "user-123", token: "bad-token" })
      ).rejects.toThrow(TokenInvalidError);

      expect(userRepository.markEmailVerified).not.toHaveBeenCalled();
    });
  });
});
