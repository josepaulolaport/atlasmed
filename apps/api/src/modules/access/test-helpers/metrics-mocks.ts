import { mock } from "bun:test";
import type { IMetrics } from "../application/interfaces/metrics.interface";

const noop = () => mock(() => {});

/**
 * Full metrics mock — prevents partial mock.module from breaking other tests.
 */
export function createMockMetricsService(
  overrides: Partial<Record<keyof IMetrics, ReturnType<typeof mock>>> = {}
): IMetrics {
  return {
    recordLoginAttempt: noop(),
    recordRefresh: noop(),
    recordPasswordReset: noop(),
    recordInvite: noop(),
    recordAuditLog: noop(),
    recordAuditLogFailure: noop(),
    recordSessionRevoked: noop(),
    recordSuspiciousActivity: noop(),
    recordScopeClinicResolutionStub: noop(),
    recordSiemExportBatch: noop(),
    ...overrides,
  };
}
