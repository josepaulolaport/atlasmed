export interface SessionSecurityCheck {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionIpAddress?: string;
  sessionUserAgent?: string;
  sessionDeviceFingerprint?: string;
}

export interface ISessionSecurityService {
  validateSessionSecurity(
    params: SessionSecurityCheck & {
      userId: string;
      sessionId: string;
    }
  ): Promise<{ valid: boolean; reason?: string; suspicious: boolean }>;
}
