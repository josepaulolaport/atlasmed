import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../modules/access/test-helpers/audit-mocks";
import { createMockMetricsService } from "../../modules/access/test-helpers/metrics-mocks";

const mockLogSuspiciousActivity = mock(async () => {});
const mockRecordSuspiciousActivity = mock(() => {});

mock.module("../audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService({
    logSuspiciousActivity: mockLogSuspiciousActivity,
  }),
}));

mock.module("../monitoring/metrics.service", () => ({
  metricsService: createMockMetricsService({
    recordSuspiciousActivity: mockRecordSuspiciousActivity,
  }),
}));

import { generateDeviceFingerprint } from "../../shared/utils/device-fingerprint";
import { sessionSecurityService } from "./session-security.service";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

describe("SessionSecurityService", () => {
  beforeEach(() => {
    mockLogSuspiciousActivity.mockClear();
    mockRecordSuspiciousActivity.mockClear();
  });

  describe("validateSessionSecurity", () => {
    it("returns valid when IP, user agent, and fingerprint match", async () => {
      const fingerprint = generateDeviceFingerprint({
        userAgent: CHROME_UA,
        acceptLanguage: "en-US",
      });

      const result = await sessionSecurityService.validateSessionSecurity({
        userId: "user-123",
        sessionId: "session-123",
        ipAddress: "192.168.1.10",
        userAgent: CHROME_UA,
        deviceFingerprint: fingerprint,
        sessionIpAddress: "192.168.1.20",
        sessionUserAgent: CHROME_UA,
        sessionDeviceFingerprint: fingerprint,
      });

      expect(result.valid).toBe(true);
      expect(result.suspicious).toBe(false);
      expect(mockLogSuspiciousActivity).not.toHaveBeenCalled();
      expect(mockRecordSuspiciousActivity).not.toHaveBeenCalled();
    });

    it("flags suspicious when IP changes to a different /24 network", async () => {
      const result = await sessionSecurityService.validateSessionSecurity({
        userId: "user-123",
        sessionId: "session-123",
        ipAddress: "10.0.0.1",
        userAgent: CHROME_UA,
        sessionIpAddress: "192.168.1.1",
        sessionUserAgent: CHROME_UA,
      });

      expect(result.valid).toBe(false);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain("IP address changed significantly");
      expect(mockLogSuspiciousActivity).toHaveBeenCalledTimes(1);
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith("ip_mismatch");
    });

    it("flags suspicious when user agent browser family changes", async () => {
      const result = await sessionSecurityService.validateSessionSecurity({
        userId: "user-123",
        sessionId: "session-123",
        ipAddress: "192.168.1.1",
        userAgent: FIREFOX_UA,
        sessionIpAddress: "192.168.1.1",
        sessionUserAgent: CHROME_UA,
      });

      expect(result.valid).toBe(false);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain("User agent changed significantly");
      expect(mockLogSuspiciousActivity).toHaveBeenCalledTimes(1);
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith(
        "user_agent_mismatch"
      );
    });

    it("flags suspicious when device fingerprint mismatches", async () => {
      const sessionFingerprint = generateDeviceFingerprint({
        userAgent: CHROME_UA,
        acceptLanguage: "en-US",
      });
      const currentFingerprint = generateDeviceFingerprint({
        userAgent: CHROME_UA,
        acceptLanguage: "fr-FR",
      });

      const result = await sessionSecurityService.validateSessionSecurity({
        userId: "user-123",
        sessionId: "session-123",
        ipAddress: "192.168.1.1",
        userAgent: CHROME_UA,
        deviceFingerprint: currentFingerprint,
        sessionIpAddress: "192.168.1.1",
        sessionUserAgent: CHROME_UA,
        sessionDeviceFingerprint: sessionFingerprint,
      });

      expect(result.valid).toBe(false);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain("Device fingerprint mismatch");
      expect(mockLogSuspiciousActivity).toHaveBeenCalledTimes(1);
      expect(mockRecordSuspiciousActivity).toHaveBeenCalledWith(
        "device_fingerprint_mismatch"
      );
    });
  });
});
