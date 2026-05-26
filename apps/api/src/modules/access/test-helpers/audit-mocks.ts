import { mock } from "bun:test";

const noop = () => mock(async () => {});

/**
 * Full audit log mock — prevents partial mock.module from breaking other tests.
 * Pass overrides for methods you need to spy on.
 */
export function createMockAuditLogService(
  overrides: Record<string, ReturnType<typeof mock>> = {}
) {
  return {
    log: noop(),
    logFailedLoginAttempt: noop(),
    logUserLogin: noop(),
    logUserLogout: noop(),
    logPasswordChange: noop(),
    logPasswordResetRequest: noop(),
    logRevokeInvite: noop(),
    logInviteUser: noop(),
    logAcceptInvite: noop(),
    logUserRegister: noop(),
    logUserStatusChange: noop(),
    logRoleChange: noop(),
    logSessionRevoke: noop(),
    logSuspiciousActivity: noop(),
    logEmailVerification: noop(),
    logPhoneVerification: noop(),
    log2FAEnable: noop(),
    log2FADisable: noop(),
    logDataAccess: noop(),
    logDataExport: noop(),
    ...overrides,
  };
}
