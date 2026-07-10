import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { redis } from "../cache/redis.client";
import { db } from "../database/db";
import { sessions, invitations, passwordResets, verificationTokens, auditLogs } from "@atlasmed/database";
import { lt, or, isNotNull, and, inArray, sql, eq } from "drizzle-orm";
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
          const deleted = await db.delete(sessions).where(
            or(
              lt(sessions.expiresAt, new Date()),
              and(
                isNotNull(sessions.revokedAt),
                lt(sessions.revokedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
              )
            )
          ).returning({ id: sessions.id });
          console.log(`Cleaned up ${deleted.length} expired/revoked sessions`);
          break;
        }

        case "cleanup-expired-invites": {
          const updated = await db.update(invitations)
            .set({ status: "EXPIRED", updatedAt: new Date() })
            .where(and(eq(invitations.status, "PENDING"), lt(invitations.expiresAt, new Date())))
            .returning({ id: invitations.id });
          console.log(`Marked ${updated.length} invites as expired`);
          break;
        }

        case "cleanup-expired-password-resets": {
          const deleted = await db.delete(passwordResets).where(
            or(
              lt(passwordResets.expiresAt, new Date()),
              and(
                isNotNull(passwordResets.usedAt),
                lt(passwordResets.usedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
              )
            )
          ).returning({ id: passwordResets.id });
          console.log(`Cleaned up ${deleted.length} expired/used password resets`);
          break;
        }

        case "cleanup-expired-verification-tokens": {
          const deleted = await db.delete(verificationTokens).where(
            or(
              lt(verificationTokens.expiresAt, new Date()),
              and(
                isNotNull(verificationTokens.verifiedAt),
                lt(verificationTokens.verifiedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
              )
            )
          ).returning({ id: verificationTokens.id });
          console.log(`Cleaned up ${deleted.length} expired/verified tokens`);
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

          const { gt, asc } = await import("drizzle-orm");
          const logs = await db.select().from(auditLogs)
            .where(gt(auditLogs.createdAt, since))
            .orderBy(asc(auditLogs.createdAt))
            .limit(500);

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

          const deleted = await db.delete(auditLogs).where(
            and(
              lt(auditLogs.createdAt, cutoffDate),
              inArray(auditLogs.severity, ["INFO"])
            )
          ).returning({ id: auditLogs.id });
          console.log(`Cleaned up ${deleted.length} old audit logs (retention: ${retentionDays} days)`);
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
