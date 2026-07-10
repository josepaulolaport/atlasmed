import { apiEnv } from "@atlasmed/config";

import type {
  EmailService,
  SendEmailParams,
} from "../../../modules/access/application/interfaces/email.service.interface";

import { resend } from "./resend.client";
import { ExternalServiceError } from "../../../shared/errors";

export class ResendEmailService implements EmailService {
  async send(params: SendEmailParams): Promise<void> {
    if (!resend) {
      console.warn("Resend client not initialized. Skipping email send.");
      return;
    }

    try {
      await resend.emails.send({
        from: apiEnv.RESEND_FROM_EMAIL!,
        to: params.to,
        subject: params.subject,
        react: params.react,
      });
    } catch (error) {
      throw new ExternalServiceError("Resend", error instanceof Error ? error : undefined);
    }
  }
}
