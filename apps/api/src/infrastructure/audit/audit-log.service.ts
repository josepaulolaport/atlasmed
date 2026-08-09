import { db } from "../database/db";
import { auditLogs } from "@atlasmed/database";
import { eq, and, gte, lte } from "drizzle-orm";
import { metricsService } from "../monitoring/metrics.service";
import { logger } from "../logging/logger";
import { environment } from "../../app/config/environment";
import type { AuditEventSeverity } from "@atlasmed/database";

export interface AuditLogEntry {
  userId?: number | undefined;
  eventType: string;
  severity?: AuditEventSeverity | undefined;
  actor?: string | undefined;
  actorId?: number | undefined;
  resource?: string | undefined;
  resourceId?: string | undefined;
  action: string;
  details?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  sessionId?: number | undefined;
  outcome?: string | undefined;
  errorMessage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * The typed helper methods on this class (`logUserLogin`, `logInviteUser`, etc.)
 * are @deprecated. New routes must NOT call them — the `auditMiddleware` plugin
 * records audit entries automatically from HTTP method + path.
 *
 * The helpers remain only for flows that run outside the normal request/response
 * lifecycle (e.g. failed login attempts that never reach onAfterHandle).
 * They will be removed in Phase 2.
 */
export class AuditLogService {
  private async writeLog(entry: AuditLogEntry): Promise<void> {
    const severity = entry.severity || "INFO";

    await db.insert(auditLogs).values({
      userId: entry.userId,
      eventType: entry.eventType,
      severity,
      actor: entry.actor,
      actorId: entry.actorId,
      resource: entry.resource,
      resourceId: entry.resourceId,
      action: entry.action,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
      outcome: entry.outcome ?? "SUCCESS",
      errorMessage: entry.errorMessage,
      metadata: entry.metadata ?? null,
    });

    metricsService.recordAuditLog(entry.eventType, severity);
  }

  async log(entry: AuditLogEntry): Promise<void> {
    if (!environment.ENABLE_AUDIT_LOG) {
      return;
    }

    try {
      await this.writeLog(entry);
    } catch (error) {
      logger.error("Failed to write audit log, retrying once", error);
      metricsService.recordAuditLogFailure(entry.eventType);

      try {
        await this.writeLog(entry);
      } catch (retryError) {
        logger.error("Audit log retry failed", retryError);
        metricsService.recordAuditLogFailure(entry.eventType);
      }
    }
  }

  /**
   * @deprecated Use the automatic audit middleware instead.
   * These typed helpers remain only for login/logout flows that run outside
   * the normal HTTP handler lifecycle (e.g. failed logins that never reach
   * onAfterHandle). Remove in Phase 2 once those flows are covered.
   */
  async logFailedLoginAttempt(params: {
    identifier: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: number;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGIN",
      severity: "WARNING",
      action: "login",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: "FAILURE",
      details: {
        identifier: params.identifier,
        reason: params.reason,
      },
    });
  }

  /** @deprecated Use the automatic audit middleware instead. */
  async logUserLogin(params: {
    userId: number;
    sessionId: number;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGIN",
      severity: params.success ? "INFO" : "WARNING",
      action: "login",
      resource: "user",
      resourceId: String(params.userId),
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: params.success ? "SUCCESS" : "FAILURE",
      errorMessage: params.errorMessage,
    });
  }

  async logUserLogout(params: {
    userId: number;
    sessionId: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGOUT",
      action: "logout",
      resource: "session",
      resourceId: String(params.sessionId),
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
    });
  }

  async logPasswordChange(params: {
    userId: number;
    ipAddress?: string;
    userAgent?: string;
    method: "reset" | "change";
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "PASSWORD_CHANGE",
      severity: "WARNING",
      action: params.method === "reset" ? "password_reset" : "password_change",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { method: params.method },
    });
  }

  async logPasswordResetRequest(params: {
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "PASSWORD_RESET_REQUEST",
      severity: "WARNING",
      action: "request_password_reset",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async logRevokeInvite(params: {
    revokedByUserId: number;
    inviteId: number;
    email?: string;
    phoneNumber?: string;
  }): Promise<void> {
    await this.log({
      userId: params.revokedByUserId,
      eventType: "USER_INVITE",
      severity: "WARNING",
      action: "revoke_invite",
      resource: "invitation",
      resourceId: String(params.inviteId),
      actorId: params.revokedByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
      },
    });
  }

  async logInviteUser(params: {
    invitedByUserId: number;
    inviteId: number;
    email?: string;
    phoneNumber?: string;
    roleId: number;
  }): Promise<void> {
    await this.log({
      userId: params.invitedByUserId,
      eventType: "USER_INVITE",
      action: "create_invite",
      resource: "invitation",
      resourceId: String(params.inviteId),
      actorId: params.invitedByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
        roleId: params.roleId,
      },
    });
  }

  async logResendInvite(params: {
    resentByUserId: number;
    inviteId: number;
    email?: string;
    phoneNumber?: string;
    resendCount: number;
  }): Promise<void> {
    await this.log({
      userId: params.resentByUserId,
      eventType: "USER_INVITE",
      action: "resend_invite",
      resource: "invitation",
      resourceId: String(params.inviteId),
      actorId: params.resentByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
        resendCount: params.resendCount,
      },
    });
  }

  async logAcceptInvite(params: {
    userId: number;
    inviteId: number;
    username: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_ACCEPT_INVITE",
      action: "accept_invite",
      resource: "invitation",
      resourceId: String(params.inviteId),
      details: { username: params.username },
    });
  }

  async logUserRegister(params: {
    userId: number;
    username: string;
    email: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_REGISTER",
      action: "register",
      resource: "user",
      resourceId: String(params.userId),
      details: { username: params.username, email: params.email },
    });
  }

  async logUserStatusChange(params: {
    userId: number;
    targetUserId: number;
    oldStatus: string;
    newStatus: string;
    reason?: string;
  }): Promise<void> {
    const eventType = this.resolveStatusChangeEventType(
      params.oldStatus,
      params.newStatus
    );

    await this.log({
      userId: params.userId,
      eventType,
      severity: params.newStatus === "SUSPENDED" ? "WARNING" : "INFO",
      action: `change_status_${params.newStatus.toLowerCase()}`,
      resource: "user",
      resourceId: String(params.targetUserId),
      actorId: params.userId,
      details: {
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
        reason: params.reason,
      },
    });
  }

  async logRoleChange(params: {
    userId: number;
    targetUserId: number;
    oldRoleId: number;
    newRoleId: number;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "ROLE_CHANGE",
      severity: "WARNING",
      action: "change_role",
      resource: "user",
      resourceId: String(params.targetUserId),
      actorId: params.userId,
      details: {
        oldRoleId: params.oldRoleId,
        newRoleId: params.newRoleId,
      },
    });
  }

  async logSessionRevoke(params: {
    userId: number;
    sessionId: number;
    reason?: string;
    revokedByUserId?: number;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "SESSION_REVOKE",
      action: "revoke_session",
      resource: "session",
      resourceId: String(params.sessionId),
      actorId: params.revokedByUserId,
      details: { reason: params.reason },
    });
  }

  async logSuspiciousActivity(params: {
    userId?: number;
    sessionId?: number;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "SUSPICIOUS_ACTIVITY",
      severity: "CRITICAL",
      action: "suspicious_activity_detected",
      resource: "security",
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        reason: params.reason,
        ...params.details,
      },
    });
  }

  async logEmailVerification(params: {
    userId: number;
    email: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "EMAIL_VERIFY",
      action: "verify_email",
      resource: "user",
      resourceId: String(params.userId),
      details: { email: params.email },
    });
  }

  async logPhoneVerification(params: {
    userId: number;
    phoneNumber: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "PHONE_VERIFY",
      action: "verify_phone",
      resource: "user",
      resourceId: String(params.userId),
      details: { phoneNumber: params.phoneNumber },
    });
  }

  async logSessionCreate(params: {
    userId: number;
    sessionId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "SESSION_CREATE",
      action: "create_session",
      resource: "session",
      resourceId: String(params.sessionId),
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async log2FARequired(params: {
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGIN",
      severity: "INFO",
      action: "2fa_required",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: "PENDING",
    });
  }

  async log2FAEnable(params: {
    userId: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "TWO_FACTOR_ENABLE",
      severity: "WARNING",
      action: "enable_2fa",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
    });
  }

  async log2FADisable(params: {
    userId: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "TWO_FACTOR_DISABLE",
      severity: "WARNING",
      action: "disable_2fa",
      resource: "user",
      resourceId: String(params.userId),
      ipAddress: params.ipAddress,
    });
  }

  async logDataAccess(params: {
    userId: number;
    resource: string;
    resourceId: string;
    action: string;
    sessionId?: number;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "DATA_ACCESS",
      action: params.action,
      resource: params.resource,
      resourceId: String(params.resourceId),
      sessionId: params.sessionId,
    });
  }

  async logDataExport(params: {
    userId: number;
    resource: string;
    count: number;
    sessionId?: number;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "DATA_EXPORT",
      severity: "WARNING",
      action: "export_data",
      resource: params.resource,
      sessionId: params.sessionId,
      details: { count: params.count },
    });
  }

  private resolveStatusChangeEventType(
    oldStatus: string,
    newStatus: string
  ): string {
    if (newStatus === "SUSPENDED") return "USER_SUSPEND";
    if (newStatus === "INACTIVE") return "USER_DEACTIVATE";
    if (newStatus === "ACTIVE" && oldStatus === "SUSPENDED") return "USER_UNSUSPEND";
    if (newStatus === "ACTIVE") return "USER_ACTIVATE";
    return "USER_DEACTIVATE";
  }

  async getAuditLogs(params: {
    userId?: number;
    eventType?: string;
    severity?: AuditEventSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    if (params.userId) conditions.push(eq(auditLogs.userId, params.userId));
    if (params.eventType) conditions.push(eq(auditLogs.eventType, params.eventType));
    if (params.severity) conditions.push(eq(auditLogs.severity, params.severity));
    if (params.startDate) conditions.push(gte(auditLogs.createdAt, params.startDate));
    if (params.endDate) conditions.push(lte(auditLogs.createdAt, params.endDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const { sql: sqlTag, count } = await import("drizzle-orm").then((m) => ({
      sql: m.sql,
      count: m.count,
    }));

    const [logs, countResult] = await Promise.all([
      db.select().from(auditLogs).where(where).orderBy(auditLogs.createdAt).limit(limit).offset(offset),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);

    return { logs, total: Number(countResult[0]?.total ?? 0) };
  }
}

export const auditLogService = new AuditLogService();
