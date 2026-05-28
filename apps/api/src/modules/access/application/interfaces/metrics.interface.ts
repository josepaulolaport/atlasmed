export interface IMetrics {
  recordLoginAttempt(success: boolean, reason?: string): void;
  recordRefresh(success: boolean, reason?: string): void;
  recordPasswordReset(method: "request" | "complete"): void;
  recordInvite(channel: "email" | "phone", type?: "create" | "resend"): void;
  recordAuditLog(eventType: string, severity: string): void;
  recordAuditLogFailure(eventType: string): void;
  recordSessionRevoked(reason: string): void;
  recordSuspiciousActivity(type: string): void;
  recordScopeClinicResolutionStub(territoryCount: number): void;
  recordSiemExportBatch(success: boolean): void;
}
