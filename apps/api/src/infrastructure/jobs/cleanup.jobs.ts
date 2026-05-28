import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { redis } from "../cache/redis.client";
import { prisma } from "../database/prisma.client";
import { environment } from "../../app/config/environment";
import {
  formatAuditLogForSiem,
  postSiemBatch,
} from "../audit/siem-export.helper";
import { metricsService } from "../monitoring/metrics.service";

const SIEM_CURSOR_KEY = "siem:lastExportAt";

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

  async scheduleOldAuditLogsCleanup(
    retentionDays: number = environment.AUDIT_LOG_RETENTION_DAYS
  ): Promise<void> {
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

  async scheduleSiemAuditExport(): Promise<void> {
    if (!environment.SIEM_EXPORT_ENABLED || !environment.SIEM_WEBHOOK_URL) {
      return;
    }

    await cleanupQueue.add(
      "export-audit-logs-siem",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "*/15 * * * *",
        },
      }
    );
  }

  async scheduleExpiredPermissionsCleanup(): Promise<void> {
    await cleanupQueue.add(
      "cleanup-expired-permissions",
      {},
      {
        ...defaultJobOptions,
        repeat: {
          pattern: "0 3 * * *",
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
      this.scheduleExpiredPermissionsCleanup(),
      this.scheduleOldAuditLogsCleanup(),
      this.scheduleSiemAuditExport(),
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

        case "cleanup-expired-permissions": {
          const { accessGrantService } = await import(
            "../../modules/access/composition"
          );
          const removed = await accessGrantService.cleanupExpiredPermissions();
          console.log(`Cleaned up ${removed} expired permission grants`);
          break;
        }

        case "export-audit-logs-siem": {
          const webhookUrl = environment.SIEM_WEBHOOK_URL;
          if (!environment.SIEM_EXPORT_ENABLED || !webhookUrl) {
            break;
          }

          const cursorRaw = await redis.get(SIEM_CURSOR_KEY);
          const since = cursorRaw
            ? new Date(cursorRaw)
            : new Date(Date.now() - 15 * 60 * 1000);

          const logs = await prisma.auditLog.findMany({
            where: { createdAt: { gt: since } },
            orderBy: { createdAt: "asc" },
            take: 500,
          });

          if (logs.length === 0) {
            metricsService.recordSiemExportBatch(true);
            break;
          }

          try {
            const events = logs.map(formatAuditLogForSiem);
            await postSiemBatch(events, {
              webhookUrl,
              secret: environment.SIEM_WEBHOOK_SECRET,
            });
            const lastExported = logs[logs.length - 1]!.createdAt.toISOString();
            await redis.set(SIEM_CURSOR_KEY, lastExported);
            metricsService.recordSiemExportBatch(true);
            console.log(`Exported ${logs.length} audit events to SIEM webhook`);
          } catch (error) {
            metricsService.recordSiemExportBatch(false);
            throw error;
          }
          break;
        }

        case "cleanup-old-audit-logs": {
          const retentionDays = data.retentionDays || environment.AUDIT_LOG_RETENTION_DAYS;
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
