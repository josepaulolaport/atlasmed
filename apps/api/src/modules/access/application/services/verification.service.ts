import { generateRandomToken } from "../../../../shared/utils/generate-random-token";
import { hashToken } from "../../../../shared/utils/hash-token";
import type { VerificationTokenType } from "@atlasmed/database";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { notificationQueue } from "../../../../infrastructure/jobs/notification.queue";
import {
  ResourceConflictError,
  TokenInvalidError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

import type { VerificationTokenRepository } from "../interfaces/verification-token.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";

interface Dependencies {
  verificationTokenRepository: VerificationTokenRepository;
  userRepository: UserRepository;
}

export class VerificationService {
  private readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

  constructor(private readonly deps: Dependencies) {}

  async createVerificationToken(params: {
    userId: string;
    type: VerificationTokenType;
    newValue?: string;
  }): Promise<string> {
    const token = generateRandomToken();
    const tokenHash = hashToken(token);

    await this.deps.verificationTokenRepository.deleteUnusedByUserAndType(
      params.userId,
      params.type
    );

    await this.deps.verificationTokenRepository.create({
      userId: params.userId,
      type: params.type,
      tokenHash,
      newValue: params.newValue,
      expiresAt: new Date(Date.now() + this.TOKEN_EXPIRY),
    });

    return token;
  }

  async verifyToken(params: {
    token: string;
    type: VerificationTokenType;
    userId: string;
  }): Promise<{ valid: boolean; newValue?: string }> {
    const tokenHash = hashToken(params.token);

    const verification = await this.deps.verificationTokenRepository.findValidToken({
      tokenHash,
      userId: params.userId,
      type: params.type,
    });

    if (!verification) {
      return { valid: false };
    }

    await this.deps.verificationTokenRepository.markVerified(verification.id);

    return {
      valid: true,
      newValue: verification.newValue || undefined,
    };
  }

  async verifyEmail(params: { userId: string; token: string }): Promise<void> {
    const result = await this.verifyToken({
      token: params.token,
      type: "EMAIL_VERIFICATION",
      userId: params.userId,
    });

    if (!result.valid) {
      throw new TokenInvalidError("Invalid or expired verification token");
    }

    await this.deps.userRepository.markEmailVerified(params.userId);

    const user = await this.deps.userRepository.findEmailVerificationState(params.userId);

    if (user) {
      await auditLogService.logEmailVerification({
        userId: params.userId,
        email: user.email,
      });
    }
  }

  async verifyPhone(params: { userId: string; token: string }): Promise<void> {
    const result = await this.verifyToken({
      token: params.token,
      type: "PHONE_VERIFICATION",
      userId: params.userId,
    });

    if (!result.valid) {
      throw new TokenInvalidError("Invalid or expired verification token");
    }

    await this.deps.userRepository.markPhoneVerified(params.userId);

    const user = await this.deps.userRepository.findPhoneVerificationState(params.userId);

    if (user?.phoneNumber) {
      await auditLogService.logPhoneVerification({
        userId: params.userId,
        phoneNumber: user.phoneNumber,
      });
    }
  }

  async changeEmail(params: {
    userId: string;
    newEmail: string;
    token: string;
  }): Promise<void> {
    const result = await this.verifyToken({
      token: params.token,
      type: "EMAIL_CHANGE",
      userId: params.userId,
    });

    if (!result.valid || result.newValue !== params.newEmail) {
      throw new TokenInvalidError("Invalid or expired verification token");
    }

    await this.deps.userRepository.updateEmail(params.userId, params.newEmail);

    await auditLogService.log({
      userId: params.userId,
      eventType: "EMAIL_CHANGE",
      severity: "WARNING",
      action: "change_email",
      resource: "user",
      resourceId: params.userId,
      details: { newEmail: params.newEmail },
    });
  }

  async changePhone(params: {
    userId: string;
    newPhone: string;
    token: string;
  }): Promise<void> {
    const result = await this.verifyToken({
      token: params.token,
      type: "PHONE_CHANGE",
      userId: params.userId,
    });

    if (!result.valid || result.newValue !== params.newPhone) {
      throw new TokenInvalidError("Invalid or expired verification token");
    }

    await this.deps.userRepository.updatePhone(params.userId, params.newPhone);

    await auditLogService.log({
      userId: params.userId,
      eventType: "PHONE_CHANGE",
      severity: "WARNING",
      action: "change_phone",
      resource: "user",
      resourceId: params.userId,
      details: { newPhone: params.newPhone },
    });
  }

  async requestEmailVerification(params: { userId: string }): Promise<void> {
    const user = await this.deps.userRepository.findEmailVerificationState(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    if (user.emailVerified) {
      throw new ValidationError([{ field: "email", message: "Email already verified" }]);
    }

    const token = await this.createVerificationToken({
      userId: params.userId,
      type: "EMAIL_VERIFICATION",
    });

    await notificationQueue.sendEmail({
      to: user.email,
      subject: "Verify your email address",
      template: "email-verification",
      data: { token },
    });
  }

  async requestPhoneVerification(params: { userId: string }): Promise<void> {
    const user = await this.deps.userRepository.findPhoneVerificationState(params.userId);

    if (!user?.phoneNumber) {
      throw new UserNotFoundError(params.userId);
    }

    if (user.phoneVerified) {
      throw new ValidationError([{ field: "phone", message: "Phone already verified" }]);
    }

    const token = await this.createVerificationToken({
      userId: params.userId,
      type: "PHONE_VERIFICATION",
    });

    await notificationQueue.sendSms({
      to: user.phoneNumber,
      message: `Your verification code is: ${token}. It will expire in 24 hours. - AtlasMed`,
    });
  }

  async requestEmailChange(params: { userId: string; newEmail: string }): Promise<void> {
    const existingUser = await this.deps.userRepository.findByEmail(params.newEmail);

    if (existingUser && existingUser.id !== params.userId) {
      throw new ResourceConflictError("email", params.newEmail);
    }

    const token = await this.createVerificationToken({
      userId: params.userId,
      type: "EMAIL_CHANGE",
      newValue: params.newEmail,
    });

    await notificationQueue.sendEmail({
      to: params.newEmail,
      subject: "Verify your new email address",
      template: "email-verification",
      data: { token },
    });
  }

  async requestPhoneChange(params: { userId: string; newPhone: string }): Promise<void> {
    const existingUser = await this.deps.userRepository.findByPhone(params.newPhone);

    if (existingUser && existingUser.id !== params.userId) {
      throw new ResourceConflictError("phone", params.newPhone);
    }

    const token = await this.createVerificationToken({
      userId: params.userId,
      type: "PHONE_CHANGE",
      newValue: params.newPhone,
    });

    await notificationQueue.sendSms({
      to: params.newPhone,
      message: `Your verification code is: ${token}. It will expire in 24 hours. - AtlasMed`,
    });
  }
}
