import { auditLogService } from "../audit/audit-log.service";
import { metricsService } from "../monitoring/metrics.service";

export interface SessionSecurityCheck {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionIpAddress?: string;
  sessionUserAgent?: string;
  sessionDeviceFingerprint?: string;
}

export type SessionSecurityMode = "strict" | "audit_only";

function getSessionSecurityMode(): SessionSecurityMode {
  const mode = process.env.SESSION_SECURITY_MODE?.trim().toLowerCase();
  return mode === "audit_only" ? "audit_only" : "strict";
}

export class SessionSecurityService {
  private readonly USER_AGENT_CHANGE_SUSPICIOUS = true;
  private readonly mode: SessionSecurityMode = getSessionSecurityMode();

  async validateSessionSecurity(
    params: SessionSecurityCheck & {
      userId: string;
      sessionId: string;
    }
  ): Promise<{ valid: boolean; reason?: string; suspicious: boolean }> {
    const issues: string[] = [];
    let suspicious = false;

    if (params.ipAddress && params.sessionIpAddress) {
      if (params.ipAddress !== params.sessionIpAddress) {
        if (!this.isIpAddressInSameNetwork(params.ipAddress, params.sessionIpAddress)) {
          suspicious = true;
          issues.push("IP address changed significantly");

          await auditLogService.logSuspiciousActivity({
            userId: params.userId,
            sessionId: params.sessionId,
            reason: "IP address mismatch",
            ipAddress: params.ipAddress,
            userAgent: params.userAgent || undefined,
            details: {
              sessionIp: params.sessionIpAddress,
              currentIp: params.ipAddress,
            },
          });

          metricsService.recordSuspiciousActivity("ip_mismatch");
        }
      }
    }

    if (
      this.USER_AGENT_CHANGE_SUSPICIOUS &&
      params.userAgent &&
      params.sessionUserAgent &&
      params.userAgent !== params.sessionUserAgent
    ) {
      const uaChange = this.compareUserAgents(params.userAgent, params.sessionUserAgent);

      if (uaChange.majorChange) {
        suspicious = true;
        issues.push("User agent changed significantly");

        await auditLogService.logSuspiciousActivity({
          userId: params.userId,
          sessionId: params.sessionId,
          reason: "User agent mismatch",
          ipAddress: params.ipAddress || undefined,
          userAgent: params.userAgent || undefined,
          details: {
            sessionUserAgent: params.sessionUserAgent,
            currentUserAgent: params.userAgent,
          },
        });

        metricsService.recordSuspiciousActivity("user_agent_mismatch");
      }
    }

    if (
      params.deviceFingerprint &&
      params.sessionDeviceFingerprint &&
      params.deviceFingerprint !== params.sessionDeviceFingerprint
    ) {
      suspicious = true;
      issues.push("Device fingerprint mismatch");

      await auditLogService.logSuspiciousActivity({
        userId: params.userId,
        sessionId: params.sessionId,
        reason: "Device fingerprint mismatch",
        ipAddress: params.ipAddress || undefined,
        userAgent: params.userAgent || undefined,
        details: {
          sessionFingerprint: params.sessionDeviceFingerprint,
          currentFingerprint: params.deviceFingerprint,
        },
      });

      metricsService.recordSuspiciousActivity("device_fingerprint_mismatch");
    }

    if (this.mode === "audit_only") {
      return {
        valid: true,
        reason: issues.join(", "),
        suspicious,
      };
    }

    return {
      valid: !suspicious,
      reason: issues.join(", "),
      suspicious,
    };
  }

  private isIpAddressInSameNetwork(ip1: string, ip2: string): boolean {
    const network1 = this.getIpNetwork(ip1);
    const network2 = this.getIpNetwork(ip2);

    return network1 === network2;
  }

  /** IPv4 /24 heuristic only; IPv6 addresses are compared as opaque strings. */
  private getIpNetwork(ip: string): string {
    const parts = ip.split(".");
    if (parts.length !== 4) return ip;

    return parts.slice(0, 3).join(".");
  }

  private compareUserAgents(
    ua1: string,
    ua2: string
  ): { majorChange: boolean; details: string[] } {
    const changes: string[] = [];
    let majorChange = false;

    const browser1 = this.extractBrowser(ua1);
    const browser2 = this.extractBrowser(ua2);

    if (browser1 !== browser2) {
      majorChange = true;
      changes.push(`Browser changed from ${browser1} to ${browser2}`);
    }

    const os1 = this.extractOs(ua1);
    const os2 = this.extractOs(ua2);

    if (os1 !== os2) {
      majorChange = true;
      changes.push(`OS changed from ${os1} to ${os2}`);
    }

    return { majorChange, details: changes };
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
    return "Unknown";
  }

  private extractOs(userAgent: string): string {
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad"))
      return "iOS";
    return "Unknown";
  }

  async detectSessionHijacking(params: {
    userId: string;
    sessionId: string;
    currentIpAddress?: string;
    currentUserAgent?: string;
    sessionIpAddress?: string;
    sessionUserAgent?: string;
  }): Promise<{ hijacked: boolean; confidence: number; reasons: string[] }> {
    const reasons: string[] = [];
    let confidence = 0;

    if (params.currentIpAddress && params.sessionIpAddress) {
      if (params.currentIpAddress !== params.sessionIpAddress) {
        if (!this.isIpAddressInSameNetwork(params.currentIpAddress, params.sessionIpAddress)) {
          confidence += 0.6;
          reasons.push("IP address changed to different network");
        } else {
          confidence += 0.2;
          reasons.push("IP address changed within same network");
        }
      }
    }

    if (params.currentUserAgent && params.sessionUserAgent) {
      const uaChange = this.compareUserAgents(params.currentUserAgent, params.sessionUserAgent);

      if (uaChange.majorChange) {
        confidence += 0.4;
        reasons.push(...uaChange.details);
      }
    }

    const hijacked = confidence >= 0.7;

    if (hijacked) {
      await auditLogService.logSuspiciousActivity({
        userId: params.userId,
        sessionId: params.sessionId,
        reason: "Possible session hijacking detected",
        ipAddress: params.currentIpAddress || undefined,
        userAgent: params.currentUserAgent || undefined,
        details: {
          confidence,
          reasons,
          sessionIp: params.sessionIpAddress,
          sessionUserAgent: params.sessionUserAgent,
        },
      });

      metricsService.recordSuspiciousActivity("session_hijacking");
    }

    return { hijacked, confidence, reasons };
  }
}

export const sessionSecurityService = new SessionSecurityService();
