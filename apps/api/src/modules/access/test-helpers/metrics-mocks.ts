import { mock } from "bun:test";

const noop = () => mock(() => {});

/**
 * Full metrics mock — prevents partial mock.module from breaking other tests.
 */
export function createMockMetricsService(
  overrides: Record<string, ReturnType<typeof mock>> = {}
) {
  return {
    recordHttpRequest: noop(),
    recordLoginAttempt: noop(),
    recordPasswordReset: noop(),
    recordInvite: noop(),
    recordAuditLog: noop(),
    recordSessionRevoked: noop(),
    recordSuspiciousActivity: noop(),
    recordDbQuery: noop(),
    recordRedisOperation: noop(),
    recordNotificationSent: noop(),
    recordNotificationFailed: noop(),
    updateActiveMetrics: mock(async () => {}),
    getMetrics: mock(async () => ""),
    ...overrides,
  };
}
