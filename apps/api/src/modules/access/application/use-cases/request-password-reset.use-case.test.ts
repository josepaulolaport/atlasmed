import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { EmailService } from "../interfaces/email.service.interface";
import type { MessagingService } from "../interfaces/messaging.service.interface";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { createMockUserRepository, createMockPasswordResetRepository } from "../../test-helpers/fixtures";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";

describe("RequestPasswordResetUseCase", () => {
  let useCase: RequestPasswordResetUseCase;
  let mockUserRepository: UserRepository;
  let mockPasswordResetRepository: PasswordResetRepository;
  let mockEmailService: EmailService;
  let mockMessagingService: MessagingService;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();

    mockPasswordResetRepository = createMockPasswordResetRepository();

    mockEmailService = {
      send: mock(() => Promise.resolve()),
    };

    mockMessagingService = {
      send: mock(() => Promise.resolve()),
    };
  });

  describe("execute", () => {
    it("should return early if user not found", async () => {
      useCase = new RequestPasswordResetUseCase({
        userRepository: mockUserRepository,
        passwordResetRepository: mockPasswordResetRepository,
      });

      mockUserRepository.findByIdentifier = mock(() => Promise.resolve(null));

      const result = await useCase.execute({ identifier: "nonexistent@example.com" });

      expect(result).toBeUndefined();
      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled();
    });

    it("should create password reset and send email for user with email", async () => {
      useCase = new RequestPasswordResetUseCase({
        userRepository: mockUserRepository,
        passwordResetRepository: mockPasswordResetRepository,
        emailService: mockEmailService,
      });

      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        phoneNumber: null,
      };

      mockUserRepository.findByIdentifier = mock(() => Promise.resolve(mockUser));

      const mockPasswordReset = {
        id: "reset-123",
        userId: mockUser.id,
        tokenHash: "hash-123",
        expiresAt: new Date(),
      };

      mockPasswordResetRepository.create = mock(() => Promise.resolve(mockPasswordReset));

      const result = await useCase.execute({ identifier: "user@example.com" });

      expect(result?.passwordReset).toEqual(mockPasswordReset);
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: "Password Reset Request",
        })
      );
    });

    it("should create password reset and send message for user with phone", async () => {
      useCase = new RequestPasswordResetUseCase({
        userRepository: mockUserRepository,
        passwordResetRepository: mockPasswordResetRepository,
        messagingService: mockMessagingService,
      });

      const mockUser = {
        id: "user-123",
        email: null,
        phoneNumber: "+5511999999999",
      };

      mockUserRepository.findByIdentifier = mock(() => Promise.resolve(mockUser));

      const mockPasswordReset = {
        id: "reset-123",
        userId: mockUser.id,
        tokenHash: "hash-123",
        expiresAt: new Date(),
      };

      mockPasswordResetRepository.create = mock(() => Promise.resolve(mockPasswordReset));

      const result = await useCase.execute({ identifier: "+5511999999999" });

      expect(result?.passwordReset).toEqual(mockPasswordReset);
      expect(mockMessagingService.send).toHaveBeenCalled();

      const sendCall = (mockMessagingService.send as any).mock.calls[0][0];
      expect(sendCall.to).toBe(mockUser.phoneNumber);
      expect(sendCall.message).toContain("Your password reset code is:");
    });

    it("should prefer email over phone if both exist", async () => {
      useCase = new RequestPasswordResetUseCase({
        userRepository: mockUserRepository,
        passwordResetRepository: mockPasswordResetRepository,
        emailService: mockEmailService,
        messagingService: mockMessagingService,
      });

      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        phoneNumber: "+5511999999999",
      };

      mockUserRepository.findByIdentifier = mock(() => Promise.resolve(mockUser));

      mockPasswordResetRepository.create = mock(() =>
        Promise.resolve({
          id: "reset-123",
          userId: mockUser.id,
          tokenHash: "hash-123",
          expiresAt: new Date(),
        })
      );

      await useCase.execute({ identifier: "user@example.com" });

      expect(mockEmailService.send).toHaveBeenCalled();
      expect(mockMessagingService.send).not.toHaveBeenCalled();
    });
  });
});
