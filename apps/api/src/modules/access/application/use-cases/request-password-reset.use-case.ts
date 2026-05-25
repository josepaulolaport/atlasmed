import type { EmailService } from "../interfaces/email.service.interface";
import type { MessagingService } from "../interfaces/messaging.service.interface";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { PasswordResetService } from "../services/password-reset.service";
import { PasswordResetEmail } from "../../../../infrastructure/external-services/resend/templates/password-reset.email";
import { createElement } from "react";

interface Dependencies {
  userRepository: UserRepository;
  passwordResetRepository: PasswordResetRepository;
  emailService?: EmailService;
  messagingService?: MessagingService;
}

interface RequestPasswordResetParams {
  identifier: string;
  resetUrl?: string;
}

export class RequestPasswordResetUseCase {
  private readonly passwordResetService: PasswordResetService;

  constructor(private readonly deps: Dependencies) {
    this.passwordResetService = new PasswordResetService({
      passwordResetRepository: deps.passwordResetRepository,
    });
  }

  async execute(params: RequestPasswordResetParams) {
    const user = await this.deps.userRepository.findByIdentifier({
      identifier: params.identifier,
    });

    if (!user) {
      return;
    }

    const { passwordReset, token } = await this.passwordResetService.createPasswordReset({
      userId: user.id,
    });

    if (user.email && this.deps.emailService) {
      await this.deps.emailService.send({
        to: user.email,
        subject: "Password Reset Request",
        react: createElement(PasswordResetEmail, {
          token,
          resetUrl: params.resetUrl,
        }),
      });
    } else if (user.phoneNumber && this.deps.messagingService) {
      await this.deps.messagingService.send({
        to: user.phoneNumber,
        message: `Your password reset code is: ${token}`,
      });
    }

    return {
      passwordReset,
    };
  }
}
