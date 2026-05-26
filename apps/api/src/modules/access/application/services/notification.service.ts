import { apiEnv } from "@atlasmed/config";
import { resend } from "../../../../infrastructure/external-services/resend/resend.client";
import { sendPasswordResetWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";

interface SendPasswordChangedNotificationParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  timestamp: Date;
  ipAddress?: string | undefined;
}

export class NotificationService {
  async sendPasswordChangedNotification(
    params: SendPasswordChangedNotificationParams
  ): Promise<void> {
    const notifications: Promise<void>[] = [];

    const formattedTimestamp = params.timestamp.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const emailBody = `Your AtlasMed password was changed on ${formattedTimestamp}${
      params.ipAddress ? ` from IP ${params.ipAddress}` : ""
    }. If this was not you, contact support immediately.`;

    if (params.email && resend && apiEnv.RESEND_FROM_EMAIL) {
      notifications.push(
        resend.emails
          .send({
            from: apiEnv.RESEND_FROM_EMAIL,
            to: params.email,
            subject: "Your AtlasMed password was changed",
            text: emailBody,
          })
          .then(() => undefined)
          .catch((error) => {
            console.error("Failed to send password changed email:", error);
          })
      );
    } else if (params.email) {
      console.warn("Password changed email skipped — Resend not configured", {
        email: params.email,
      });
    }

    if (params.phoneNumber) {
      const message = `Security Alert: Your password was changed on ${formattedTimestamp}${
        params.ipAddress ? ` from IP ${params.ipAddress}` : ""
      }. If this wasn't you, contact support immediately. - AtlasMed`;

      notifications.push(
        sendPasswordResetWhatsApp(params.phoneNumber, message).catch((error) => {
          console.error("Failed to send password changed WhatsApp:", error);
        })
      );
    }

    if (notifications.length === 0) {
      console.warn("User has no contact method for password change notification");
    }

    await Promise.allSettled(notifications);
  }
}
