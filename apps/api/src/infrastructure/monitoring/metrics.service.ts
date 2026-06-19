import { Counter, Histogram, Gauge, register } from "prom-client";

export class MetricsService {
  private static instance: MetricsService;

  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestTotal: Counter;
  public readonly activeUsers: Gauge;
  public readonly activeSessions: Gauge;
  public readonly loginAttempts: Counter;
  public readonly loginFailures: Counter;
  public readonly refreshAttempts: Counter;
  public readonly passwordResets: Counter;
  public readonly invitesSent: Counter;
  public readonly auditLogWrites: Counter;
  public readonly sessionRevokedCounter: Counter;
  public readonly suspiciousActivityCounter: Counter;
  public readonly dbQueryDuration: Histogram;
  public readonly redisOperationDuration: Histogram;
  public readonly notificationQueueSize: Gauge;
  public readonly notificationsSent: Counter;
  public readonly notificationsFailed: Counter;
  public readonly scopeClinicStubCounter: Counter;
  public readonly auditLogFailureCounter: Counter;
  public readonly auditSiemExportBatchesCounter: Counter;
  public readonly auditSiemExportFailuresCounter: Counter;

  private constructor() {
    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestTotal = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
    });

    this.activeUsers = new Gauge({
      name: "active_users_total",
      help: "Number of active users",
    });

    this.activeSessions = new Gauge({
      name: "active_sessions_total",
      help: "Number of active sessions",
    });

    this.loginAttempts = new Counter({
      name: "login_attempts_total",
      help: "Total number of login attempts",
      labelNames: ["status"],
    });

    this.loginFailures = new Counter({
      name: "login_failures_total",
      help: "Total number of failed login attempts",
      labelNames: ["reason"],
    });

    this.refreshAttempts = new Counter({
      name: "refresh_attempts_total",
      help: "Total number of refresh token attempts",
      labelNames: ["status", "reason"],
    });

    this.passwordResets = new Counter({
      name: "password_resets_total",
      help: "Total number of password resets",
      labelNames: ["method"],
    });

    this.invitesSent = new Counter({
      name: "invites_sent_total",
      help: "Total number of invites sent",
      labelNames: ["channel", "type"],
    });

    this.auditLogWrites = new Counter({
      name: "audit_log_writes_total",
      help: "Total number of audit log entries written",
      labelNames: ["event_type", "severity"],
    });

    this.sessionRevokedCounter = new Counter({
      name: "sessions_revoked_total",
      help: "Total number of sessions revoked",
      labelNames: ["reason"],
    });

    this.suspiciousActivityCounter = new Counter({
      name: "suspicious_activity_total",
      help: "Total number of suspicious activity events",
      labelNames: ["type"],
    });

    this.dbQueryDuration = new Histogram({
      name: "db_query_duration_seconds",
      help: "Duration of database queries in seconds",
      labelNames: ["operation", "table"],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    });

    this.redisOperationDuration = new Histogram({
      name: "redis_operation_duration_seconds",
      help: "Duration of Redis operations in seconds",
      labelNames: ["operation"],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
    });

    this.notificationQueueSize = new Gauge({
      name: "notification_queue_size",
      help: "Number of notifications in queue",
      labelNames: ["queue"],
    });

    this.notificationsSent = new Counter({
      name: "notifications_sent_total",
      help: "Total number of notifications sent",
      labelNames: ["type", "channel"],
    });

    this.notificationsFailed = new Counter({
      name: "notifications_failed_total",
      help: "Total number of failed notifications",
      labelNames: ["type", "channel", "reason"],
    });

    this.scopeClinicStubCounter = new Counter({
      name: "scope_clinic_stub_unresolved_total",
      help: "Territory scope resolved but clinic port returned no clinics",
      labelNames: ["territory_count_bucket"],
    });

    this.auditLogFailureCounter = new Counter({
      name: "audit_log_write_failures_total",
      help: "Audit log writes that failed after retry",
      labelNames: ["event_type"],
    });

    this.auditSiemExportBatchesCounter = new Counter({
      name: "audit_siem_export_batches_total",
      help: "SIEM audit export batches completed",
      labelNames: ["status"],
    });

    this.auditSiemExportFailuresCounter = new Counter({
      name: "audit_siem_export_failures_total",
      help: "SIEM audit export batch failures",
    });
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public getMetrics(): Promise<string> {
    return register.metrics();
  }

  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    this.httpRequestTotal.inc({ method, route, status_code: statusCode });
  }

  public recordLoginAttempt(success: boolean, reason?: string): void {
    this.loginAttempts.inc({ status: success ? "success" : "failure" });
    if (!success && reason) {
      this.loginFailures.inc({ reason });
    }
  }

  public recordRefresh(success: boolean, reason?: string): void {
    this.refreshAttempts.inc({
      status: success ? "success" : "failure",
      reason: reason ?? "none",
    });
  }

  public recordPasswordReset(method: "request" | "complete"): void {
    this.passwordResets.inc({ method });
  }

  public recordInvite(
    channel: "email" | "phone",
    type: "create" | "resend" = "create"
  ): void {
    this.invitesSent.inc({ channel, type });
  }

  public recordSiemExportBatch(success: boolean): void {
    this.auditSiemExportBatchesCounter.inc({ status: success ? "success" : "failure" });
    if (!success) {
      this.auditSiemExportFailuresCounter.inc();
    }
  }

  public recordAuditLog(eventType: string, severity: string): void {
    this.auditLogWrites.inc({ event_type: eventType, severity });
  }

  public recordSessionRevoked(reason: string): void {
    this.sessionRevokedCounter.inc({ reason });
  }

  public recordSuspiciousActivity(type: string): void {
    this.suspiciousActivityCounter.inc({ type });
  }

  public recordDbQuery(operation: string, table: string, duration: number): void {
    this.dbQueryDuration.observe({ operation, table }, duration);
  }

  public recordRedisOperation(operation: string, duration: number): void {
    this.redisOperationDuration.observe({ operation }, duration);
  }

  public recordNotificationSent(type: string, channel: string): void {
    this.notificationsSent.inc({ type, channel });
  }

  public recordNotificationFailed(type: string, channel: string, reason: string): void {
    this.notificationsFailed.inc({ type, channel, reason });
  }

  public recordAuditLogFailure(eventType: string): void {
    this.auditLogFailureCounter.inc({ event_type: eventType });
  }

  public recordScopeClinicResolutionStub(territoryCount: number): void {
    const bucket =
      territoryCount <= 1 ? "1" : territoryCount <= 5 ? "2-5" : "6+";
    this.scopeClinicStubCounter.inc({ territory_count_bucket: bucket });
  }

  public async updateActiveMetrics(): Promise<void> {
    try {
      const [activeUserCount, activeSessionCount] = await Promise.all([
        (async () => {
          const { prisma } = await import("../database/prisma.client");
          return prisma.user.count({ where: { status: "ACTIVE" } });
        })(),
        (async () => {
          const { prisma } = await import("../database/prisma.client");
          return prisma.session.count({
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          });
        })(),
      ]);

      this.activeUsers.set(activeUserCount);
      this.activeSessions.set(activeSessionCount);
    } catch (error) {
      console.error("Failed to update active metrics:", error);
    }
  }
}

export const metricsService = MetricsService.getInstance();

setInterval(() => {
  metricsService.updateActiveMetrics().catch(console.error);
}, 60000);
