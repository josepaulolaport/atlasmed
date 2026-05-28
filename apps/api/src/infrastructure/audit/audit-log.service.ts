import { prisma } from "../database/prisma.client";
import { metricsService } from "../monitoring/metrics.service";
import { environment } from "../../app/config/environment";
import type { AuditEventType, AuditEventSeverity } from "@atlasmed/database";

export interface AuditLogEntry {
  userId?: string | undefined;
  eventType: AuditEventType;
  severity?: AuditEventSeverity | undefined;
  actor?: string | undefined;
  actorId?: string | undefined;
  resource?: string | undefined;
  resourceId?: string | undefined;
  action: string;
  details?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  sessionId?: string | undefined;
  outcome?: string | undefined;
  errorMessage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class AuditLogService {
  private async writeLog(entry: AuditLogEntry): Promise<void> {
    const severity = entry.severity || "INFO";

    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        eventType: entry.eventType,
        severity,
        actor: entry.actor,
        actorId: entry.actorId,
        resource: entry.resource,
        resourceId: entry.resourceId,
        action: entry.action,
        details: entry.details ? (entry.details as any) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        sessionId: entry.sessionId,
        outcome: entry.outcome || "SUCCESS",
        errorMessage: entry.errorMessage,
        metadata: entry.metadata ? (entry.metadata as any) : undefined,
      },
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
      console.error("Failed to write audit log, retrying once:", error);
      metricsService.recordAuditLogFailure(entry.eventType);

      try {
        await this.writeLog(entry);
      } catch (retryError) {
        console.error("Audit log retry failed:", retryError);
        metricsService.recordAuditLogFailure(entry.eventType);
      }
    }
  }

  async logFailedLoginAttempt(params: {
    identifier: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGIN",
      severity: "WARNING",
      action: "login",
      resource: "user",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: "FAILURE",
      details: {
        identifier: params.identifier,
        reason: params.reason,
      },
    });
  }

  async logUserLogin(params: {
    userId: string;
    sessionId: string;
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
      resourceId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: params.success ? "SUCCESS" : "FAILURE",
      errorMessage: params.errorMessage,
    });
  }

  async logUserLogout(params: {
    userId: string;
    sessionId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGOUT",
      action: "logout",
      resource: "session",
      resourceId: params.sessionId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
    });
  }

  async logPasswordChange(params: {
    userId: string;
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
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { method: params.method },
    });
  }

  async logPasswordResetRequest(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "PASSWORD_RESET_REQUEST",
      severity: "WARNING",
      action: "request_password_reset",
      resource: "user",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async logRevokeInvite(params: {
    revokedByUserId: string;
    inviteId: string;
    email?: string;
    phoneNumber?: string;
  }): Promise<void> {
    await this.log({
      userId: params.revokedByUserId,
      eventType: "USER_INVITE",
      severity: "WARNING",
      action: "revoke_invite",
      resource: "invitation",
      resourceId: params.inviteId,
      actorId: params.revokedByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
      },
    });
  }

  async logInviteUser(params: {
    invitedByUserId: string;
    inviteId: string;
    email?: string;
    phoneNumber?: string;
    roleId: string;
  }): Promise<void> {
    await this.log({
      userId: params.invitedByUserId,
      eventType: "USER_INVITE",
      action: "create_invite",
      resource: "invitation",
      resourceId: params.inviteId,
      actorId: params.invitedByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
        roleId: params.roleId,
      },
    });
  }

  async logResendInvite(params: {
    resentByUserId: string;
    inviteId: string;
    email?: string;
    phoneNumber?: string;
    resendCount: number;
  }): Promise<void> {
    await this.log({
      userId: params.resentByUserId,
      eventType: "USER_INVITE",
      action: "resend_invite",
      resource: "invitation",
      resourceId: params.inviteId,
      actorId: params.resentByUserId,
      details: {
        email: params.email,
        phoneNumber: params.phoneNumber,
        resendCount: params.resendCount,
      },
    });
  }

  async logAcceptInvite(params: {
    userId: string;
    inviteId: string;
    username: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_ACCEPT_INVITE",
      action: "accept_invite",
      resource: "invitation",
      resourceId: params.inviteId,
      details: { username: params.username },
    });
  }

  async logUserRegister(params: {
    userId: string;
    username: string;
    email: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_REGISTER",
      action: "register",
      resource: "user",
      resourceId: params.userId,
      details: { username: params.username, email: params.email },
    });
  }

  async logUserStatusChange(params: {
    userId: string;
    targetUserId: string;
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
      resourceId: params.targetUserId,
      actorId: params.userId,
      details: {
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
        reason: params.reason,
      },
    });
  }

  async logRoleChange(params: {
    userId: string;
    targetUserId: string;
    oldRoleId: string;
    newRoleId: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "ROLE_CHANGE",
      severity: "WARNING",
      action: "change_role",
      resource: "user",
      resourceId: params.targetUserId,
      actorId: params.userId,
      details: {
        oldRoleId: params.oldRoleId,
        newRoleId: params.newRoleId,
      },
    });
  }

  async logSessionRevoke(params: {
    userId: string;
    sessionId: string;
    reason?: string;
    revokedByUserId?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "SESSION_REVOKE",
      action: "revoke_session",
      resource: "session",
      resourceId: params.sessionId,
      actorId: params.revokedByUserId,
      details: { reason: params.reason },
    });
  }

  async logSuspiciousActivity(params: {
    userId?: string;
    sessionId?: string;
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
    userId: string;
    email: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "EMAIL_VERIFY",
      action: "verify_email",
      resource: "user",
      resourceId: params.userId,
      details: { email: params.email },
    });
  }

  async logPhoneVerification(params: {
    userId: string;
    phoneNumber: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "PHONE_VERIFY",
      action: "verify_phone",
      resource: "user",
      resourceId: params.userId,
      details: { phoneNumber: params.phoneNumber },
    });
  }

  async logSessionCreate(params: {
    userId: string;
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "SESSION_CREATE",
      action: "create_session",
      resource: "session",
      resourceId: params.sessionId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async log2FARequired(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "USER_LOGIN",
      severity: "INFO",
      action: "2fa_required",
      resource: "user",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      outcome: "PENDING",
    });
  }

  async log2FAEnable(params: {
    userId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "TWO_FACTOR_ENABLE",
      severity: "WARNING",
      action: "enable_2fa",
      resource: "user",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async log2FADisable(params: {
    userId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "TWO_FACTOR_DISABLE",
      severity: "WARNING",
      action: "disable_2fa",
      resource: "user",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async logDataAccess(params: {
    userId: string;
    resource: string;
    resourceId: string;
    action: string;
    sessionId?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      eventType: "DATA_ACCESS",
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      sessionId: params.sessionId,
    });
  }

  async logDataExport(params: {
    userId: string;
    resource: string;
    count: number;
    sessionId?: string;
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
  ): AuditEventType {
    if (newStatus === "SUSPENDED") return "USER_SUSPEND";
    if (newStatus === "INACTIVE") return "USER_DEACTIVATE";
    if (newStatus === "ACTIVE" && oldStatus === "SUSPENDED") return "USER_UNSUSPEND";
    if (newStatus === "ACTIVE") return "USER_ACTIVATE";
    return "USER_DEACTIVATE";
  }

  async getAuditLogs(params: {
    userId?: string;
    eventType?: AuditEventType;
    severity?: AuditEventSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params.userId) where.userId = params.userId;
    if (params.eventType) where.eventType = params.eventType;
    if (params.severity) where.severity = params.severity;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit || 50,
        skip: params.offset || 0,
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export const auditLogService = new AuditLogService();
