import { apiEnv } from "@atlasmed/config";

import type {
  EmailService,
  SendEmailParams,
} from "../../../modules/access/application/interfaces/email.service.interface";

import { resend } from "./resend.client";

export class ResendEmailService implements EmailService {
  async send(params: SendEmailParams): Promise<void> {
    if (!resend) {
      console.warn(
        "[Resend] Client not initialized — set RESEND_API_KEY in apps/api/.env to send emails.",
      );
      return;
    }

    if (apiEnv.RESEND_API_KEY?.includes("xxxxxxxx")) {
      console.warn(
        "[Resend] RESEND_API_KEY is a placeholder — replace it with your real key from resend.com.",
      );
      return;
    }

    if (!apiEnv.RESEND_FROM_EMAIL) {
      console.warn("[Resend] RESEND_FROM_EMAIL is not set.");
      return;
    }

    try {
      const result = await resend.emails.send({
        from: apiEnv.RESEND_FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        react: params.react,
      });

      if (result.error) {
        console.error("[Resend] Send failed:", result.error);
        throw new Error(`Failed to send email: ${result.error.message}`);
      }
    } catch (error) {
      console.error("[Resend] Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  }
}
