import { sendInviteEmail, sendPasswordResetEmail } from "../../infrastructure/email/send-email";
import { sendPasswordResetWhatsApp } from "../../../../infrastructure/external-services/twilio/send-whatsapp";

interface SendPasswordChangedNotificationParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  timestamp: Date;
  ipAddress?: string | undefined;
}

export class NotificationService {
  async sendPasswordChangedNotification(params: SendPasswordChangedNotificationParams): Promise<void> {
    const notifications: Promise<void>[] = [];

    const formattedTimestamp = params.timestamp.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (params.email) {
      // For now, we'll use a simple text-based approach
      // In production, create a proper PasswordChangedEmail React component
      notifications.push(
        Promise.resolve().then(() => {
          console.log(`Would send password changed email to ${params.email}`);
          // TODO: Implement proper email template
        })
      );
    }

    if (params.phoneNumber) {
      const message = `🔐 Security Alert: Your password was changed on ${formattedTimestamp}${params.ipAddress ? ` from IP ${params.ipAddress}` : ""}. If this wasn't you, contact support immediately. - AtlasMed`;
      
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
