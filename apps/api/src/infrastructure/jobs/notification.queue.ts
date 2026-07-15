import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { sendInviteEmail, sendPasswordResetEmail } from "../external-services/resend/send-invite-email";
import { sendPasswordResetWhatsApp } from "../external-services/twilio/send-whatsapp";
import { logger } from "../logging/logger";
import type { Worker } from "bullmq";

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
let notificationWorker: Worker<NotificationJob> | undefined;

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

export function startNotificationWorker(): void {
  if (notificationWorker) {
    logger.info("Notification worker already started");
    return;
  }

  notificationWorker = createWorker<NotificationJob>(
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
              logger.info("Sending template email", {
                template: data.template,
                to: data.to,
              });
              break;
          }
        } else if (data.type === "sms") {
          await sendPasswordResetWhatsApp(data.to, data.message);
        }

        logger.info("Notification sent", {
          type: data.type,
          to: data.to,
        });
      } catch (error) {
        logger.error("Failed to send notification", error);
        throw error;
      }
    },
    { concurrency: 5 }
  );

  notificationWorker.on("completed", (job) => {
    logger.info("Notification job completed", { jobId: job.id });
  });

  notificationWorker.on("failed", (job, error) => {
    logger.error("Notification job failed", error, { jobId: job?.id });
  });

  logger.info("Notification worker started");
}

export const notificationQueue = new NotificationQueue();
