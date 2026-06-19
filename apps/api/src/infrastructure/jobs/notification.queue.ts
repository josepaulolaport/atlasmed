import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { sendInviteEmail, sendPasswordResetEmail } from "../external-services/resend/send-invite-email";
import { sendPasswordResetWhatsApp } from "../external-services/twilio/send-whatsapp";

export interface EmailNotification {
  type: "email";
  to: string;
  subject: string;
  template: "invite" | "password-reset" | "password-changed" | "email-verification" | "security-alert";
  data: Record<string, any>;
}

export interface SmsNotification {
  type: "sms";
  to: string;
  message: string;
}

export type NotificationJob = EmailNotification | SmsNotification;

const queue = createQueue<NotificationJob>("notifications");

const defaultJobOptions: JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export class NotificationQueue {
  async sendEmail(notification: Omit<EmailNotification, "type">, options?: JobOptions): Promise<void> {
    await queue.add(
      "send-email",
      { type: "email", ...notification },
      { ...defaultJobOptions, ...options }
    );
  }

  async sendSms(notification: Omit<SmsNotification, "type">, options?: JobOptions): Promise<void> {
    await queue.add(
      "send-sms",
      { type: "sms", ...notification },
      { ...defaultJobOptions, ...options }
    );
  }

  async sendPasswordChangedNotification(params: {
    email?: string;
    phoneNumber?: string;
    timestamp: Date;
    ipAddress?: string;
  }): Promise<void> {
    const notifications: Promise<void>[] = [];

    if (params.email) {
      notifications.push(
        this.sendEmail({
          to: params.email,
          subject: "Security Alert: Password Changed",
          template: "password-changed",
          data: {
            timestamp: params.timestamp.toISOString(),
            ipAddress: params.ipAddress,
          },
        })
      );
    }

    if (params.phoneNumber) {
      const formattedTimestamp = params.timestamp.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const message = `🔐 Security Alert: Your password was changed on ${formattedTimestamp}${params.ipAddress ? ` from IP ${params.ipAddress}` : ""}. If this wasn't you, contact support immediately. - AtlasMed`;

      notifications.push(
        this.sendSms({
          to: params.phoneNumber,
          message,
        })
      );
    }

    await Promise.all(notifications);
  }

  async sendSecurityAlert(params: {
    email?: string;
    phoneNumber?: string;
    alertType: string;
    details: string;
  }): Promise<void> {
    const notifications: Promise<void>[] = [];

    if (params.email) {
      notifications.push(
        this.sendEmail({
          to: params.email,
          subject: `Security Alert: ${params.alertType}`,
          template: "security-alert",
          data: {
            alertType: params.alertType,
            details: params.details,
          },
        })
      );
    }

    if (params.phoneNumber) {
      notifications.push(
        this.sendSms({
          to: params.phoneNumber,
          message: `⚠️ Security Alert: ${params.alertType}. ${params.details} - AtlasMed`,
        })
      );
    }

    await Promise.all(notifications);
  }
}

const notificationWorker = createWorker<NotificationJob>(
  "notifications",
  async (job) => {
    const { data } = job;

    try {
      if (data.type === "email") {
        switch (data.template) {
          case "invite":
            await sendInviteEmail(data.to, data.data.token, data.data.invitedBy);
            break;
          case "password-reset":
            await sendPasswordResetEmail(data.to, data.data.token);
            break;
          case "password-changed":
          case "email-verification":
          case "security-alert":
            console.log(`Sending ${data.template} email to ${data.to}`, data.data);
            break;
        }
      } else if (data.type === "sms") {
        await sendPasswordResetWhatsApp(data.to, data.message);
      }

      console.log(`Notification sent successfully:`, {
        type: data.type,
        to: data.type === "email" ? data.to : data.to,
      });
    } catch (error) {
      console.error(`Failed to send notification:`, error);
      throw error;
    }
  },
  { concurrency: 5 }
);

notificationWorker.on("completed", (job) => {
  console.log(`Notification job ${job.id} completed`);
});

notificationWorker.on("failed", (job, error) => {
  console.error(`Notification job ${job?.id} failed:`, error);
});

export const notificationQueue = new NotificationQueue();
