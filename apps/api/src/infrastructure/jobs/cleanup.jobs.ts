import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { prisma } from "../database/prisma.client";

const cleanupQueue = createQueue("cleanup");

const defaultJobOptions: JobOptions = {
  attempts: 2,
  backoff: {
    type: "fixed",
    delay: 60000,
  },
  removeOnComplete: 10,
  removeOnFail: 50,
};

export class CleanupJobs {
  async scheduleExpiredSessionsCleanup(): Promise<void> {
    await cleanupQueue.add(
      "cleanup-expired-sessions",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 */6 * * *",
        },
      }
    );
  }

  async scheduleExpiredInvitesCleanup(): Promise<void> {
    await cleanupQueue.add(
      "cleanup-expired-invites",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 */12 * * *",
        },
      }
    );
  }

  async scheduleExpiredPasswordResetsCleanup(): Promise<void> {
    await cleanupQueue.add(
      "cleanup-expired-password-resets",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 */12 * * *",
        },
      }
    );
  }

  async scheduleExpiredVerificationTokensCleanup(): Promise<void> {
    await cleanupQueue.add(
      "cleanup-expired-verification-tokens",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 */6 * * *",
        },
      }
    );
  }

  async scheduleOldAuditLogsCleanup(retentionDays: number = 90): Promise<void> {
    await cleanupQueue.add(
      "cleanup-old-audit-logs",
      { retentionDays },
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 2 * * *",
        },
      }
    );
  }

  async initializeAllJobs(): Promise<void> {
    await Promise.all([
      this.scheduleExpiredSessionsCleanup(),
      this.scheduleExpiredInvitesCleanup(),
      this.scheduleExpiredPasswordResetsCleanup(),
      this.scheduleExpiredVerificationTokensCleanup(),
      this.scheduleOldAuditLogsCleanup(),
    ]);

    console.log("✅ All cleanup jobs scheduled successfully");
  }
}

const cleanupWorker = createWorker<any>(
  "cleanup",
  async (job) => {
    const { data, name } = job as { data: any; name?: string };

    console.log(`Running cleanup job: ${name}`);

    try {
      switch (name) {
        case "cleanup-expired-sessions": {
          const result = await prisma.session.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: new Date() } },
                { revokedAt: { not: null, lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
              ],
            },
          });
          console.log(`Cleaned up ${result.count} expired/revoked sessions`);
          break;
        }

        case "cleanup-expired-invites": {
          const result = await prisma.invitation.updateMany({
            where: {
              status: "PENDING",
              expiresAt: { lt: new Date() },
            },
            data: {
              status: "EXPIRED",
            },
          });
          console.log(`Marked ${result.count} invites as expired`);
          break;
        }

        case "cleanup-expired-password-resets": {
          const result = await prisma.passwordReset.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: new Date() } },
                { usedAt: { not: null, lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
              ],
            },
          });
          console.log(`Cleaned up ${result.count} expired/used password resets`);
          break;
        }

        case "cleanup-expired-verification-tokens": {
          const result = await prisma.verificationToken.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: new Date() } },
                { verifiedAt: { not: null, lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
              ],
            },
          });
          console.log(`Cleaned up ${result.count} expired/verified tokens`);
          break;
        }

        case "cleanup-old-audit-logs": {
          const retentionDays = data.retentionDays || 90;
          const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

          const result = await prisma.auditLog.deleteMany({
            where: {
              createdAt: { lt: cutoffDate },
              severity: { in: ["INFO"] },
            },
          });
          console.log(`Cleaned up ${result.count} old audit logs (retention: ${retentionDays} days)`);
          break;
        }

        default:
          console.warn(`Unknown cleanup job: ${name}`);
      }
    } catch (error) {
      console.error(`Cleanup job ${name} failed:`, error);
      throw error;
    }
  },
  { concurrency: 1 }
);

cleanupWorker.on("completed", (job) => {
  console.log(`✅ Cleanup job ${job.name} completed`);
});

cleanupWorker.on("failed", (job, error) => {
  console.error(`❌ Cleanup job ${job?.name} failed:`, error);
});

export const cleanupJobs = new CleanupJobs();
