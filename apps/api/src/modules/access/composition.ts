/**
 * Composition Root for Access Module
 *
 * Authorization invariants (do not bypass):
 * 1. Routes: CASL via requirePermission() after auth plugin (role + AccessGrants).
 * 2. Mutations/lists: ScopeContext from getScope() — use `clinicIds` for operational
 *    visibility and `analyticsClinicIds` for manager analytics roll-ups.
 * 3. AccessGrants (Permission table): exceptional overrides merged into CASL and scope (territory/clinic ids).
 * 4. clinicIds in ScopeContext require a real TerritoryScopePort (clinic module); stub returns [] until then.
 * 5. Session validity: JWT + session row + tokenVersion; caches revalidate from DB periodically.
 *
 * domain/ is intentionally empty until domain entities are justified.
 */

import { redis } from "../../infrastructure/cache/redis.client";
import { prisma } from "../../infrastructure/database/prisma.client";

// Repositories
import { PrismaUserRepository } from "./infrastructure/repositories/prisma/prisma-user.repository";
import { PrismaInviteRepository } from "./infrastructure/repositories/prisma/prisma-invite.repository";
import { PrismaSessionRepository } from "./infrastructure/repositories/prisma/prisma-session.repository";
import { PrismaPasswordResetRepository } from "./infrastructure/repositories/prisma/prisma-password-reset.repository";
import { PrismaRoleRepository } from "./infrastructure/repositories/prisma/prisma-role.repository";
import { PrismaVerificationTokenRepository } from "./infrastructure/repositories/prisma/prisma-verification-token.repository";

// Cache Services
import { AuthCacheService } from "./infrastructure/cache/auth-cache.service";
import { SessionCacheService } from "./infrastructure/cache/session-cache.service";

// Services
import { TokenService } from "./application/services/token.service";
import { PasswordService } from "./application/services/password.service";
import { SessionService } from "./application/services/session.service";
import { InviteService } from "./application/services/invite.service";
import { RateLimiterService } from "./application/services/rate-limiter.service";
import { NotificationService } from "./application/services/notification.service";
import { ResendEmailService } from "../../infrastructure/external-services/resend/resend-email.service";
import { TwilioMessagingService } from "../../infrastructure/external-services/twilio/twilio-messaging.service";

// Use Cases
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case";
import { InviteUserUseCase } from "./application/use-cases/invite-user.use-case";
import { AcceptInviteUseCase } from "./application/use-cases/accept-invite.use-case";
import { ValidateInviteUseCase } from "./application/use-cases/validate-invite.use-case";
import { RevokeInviteUseCase } from "./application/use-cases/revoke-invite.use-case";
import { ResendInviteUseCase } from "./application/use-cases/resend-invite.use-case";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { DeactivateUserUseCase } from "./application/use-cases/deactivate-user.use-case";
import { ActivateUserUseCase } from "./application/use-cases/activate-user.use-case";
import { SuspendUserUseCase } from "./application/use-cases/suspend-user.use-case";
import { UnsuspendUserUseCase } from "./application/use-cases/unsuspend-user.use-case";
import { GetUserSessionsUseCase } from "./application/use-cases/get-user-sessions.use-case";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case";
import { RevokeOtherSessionsUseCase } from "./application/use-cases/revoke-other-sessions.use-case";
import { GetInvitationsUseCase } from "./application/use-cases/get-invitations.use-case";
import { ChangeUserRoleUseCase } from "./application/use-cases/change-user-role.use-case";
import { ListRolesUseCase } from "./application/use-cases/list-roles.use-case";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case";
import { UpdateProfileUseCase } from "./application/use-cases/update-profile.use-case";
import { AssignUserManagerUseCase } from "./application/use-cases/assign-user-manager.use-case";
import { AssignUserTerritoryUseCase } from "./application/use-cases/assign-user-territory.use-case";
import { RevokeUserTerritoryUseCase } from "./application/use-cases/revoke-user-territory.use-case";
import { GetUserAssignmentsUseCase } from "./application/use-cases/get-user-assignments.use-case";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case";
import { Setup2FAUseCase } from "./application/use-cases/setup-2fa.use-case";
import { Confirm2FASetupUseCase } from "./application/use-cases/confirm-2fa-setup.use-case";
import { Verify2FALoginUseCase } from "./application/use-cases/verify-2fa-login.use-case";
import { Disable2FAUseCase } from "./application/use-cases/disable-2fa.use-case";
import { GetCapabilitiesUseCase } from "./application/use-cases/get-capabilities.use-case";
import { VerificationService } from "./application/services/verification.service";
import { TwoFactorService } from "./application/services/two-factor.service";
import { Pending2FALoginService } from "./application/services/pending-2fa-login.service";

import { PrismaScopeRepository } from "./infrastructure/repositories/prisma/prisma-scope.repository";
import { PrismaAccessGrantRepository } from "./infrastructure/repositories/prisma/prisma-access-grant.repository";
import { clinicTerritoryScopePort } from "../clinic/composition";
import { territoryHierarchyPort, territoryAssignmentPolicy } from "../territory/composition";
import { ScopeService } from "./application/services/scope.service";
import { AccessGrantService } from "./application/services/access-grant.service";
import { AccessGrantCacheService } from "./infrastructure/cache/access-grant-cache.service";
import { GrantPermissionUseCase } from "./application/use-cases/grant-permission.use-case";
import { RevokePermissionUseCase } from "./application/use-cases/revoke-permission.use-case";
import { createAuthPlugin } from "./infrastructure/plugins/auth.plugin";
import { auditLogAdapter } from "./infrastructure/adapters/audit-log.adapter";
import { metricsAdapter } from "./infrastructure/adapters/metrics.adapter";
import { sessionSecurityAdapter } from "./infrastructure/adapters/session-security.adapter";

export const accessInfrastructure = {
  auditLog: auditLogAdapter,
  metrics: metricsAdapter,
  sessionSecurity: sessionSecurityAdapter,
};

// Singletons - Infrastructure
export const accessRepositories = {
  user: new PrismaUserRepository(),
  invite: new PrismaInviteRepository(),
  session: new PrismaSessionRepository(),
  passwordReset: new PrismaPasswordResetRepository({ prisma }),
  role: new PrismaRoleRepository(),
  verificationToken: new PrismaVerificationTokenRepository({ prisma }),
  scope: new PrismaScopeRepository(),
  accessGrant: new PrismaAccessGrantRepository(),
};

const territoryScopePort = clinicTerritoryScopePort;
const hierarchyPort = territoryHierarchyPort;

export const accessGrantCache = new AccessGrantCacheService();

export const accessGrantService = new AccessGrantService({
  accessGrantRepository: accessRepositories.accessGrant,
  accessGrantCache,
  auditLog: accessInfrastructure.auditLog,
});

export const accessScopeServices = {
  territoryScopePort,
  territoryHierarchyPort: hierarchyPort,
  scope: new ScopeService({
    scopeRepository: accessRepositories.scope,
    territoryScopePort,
    territoryHierarchyPort: hierarchyPort,
    accessGrantService,
  }),
};

// Singletons - Cache
export const accessCaches = {
  auth: new AuthCacheService(),
  session: new SessionCacheService(),
};

// Singletons - Application Services
export const accessServices = {
  token: new TokenService(),
  password: new PasswordService(),
  session: new SessionService({ 
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
  }),
  invite: new InviteService({ inviteRepository: accessRepositories.invite }),
  rateLimiter: new RateLimiterService({ redis }),
  notification: new NotificationService(),
  email: new ResendEmailService(),
  messaging: new TwilioMessagingService(),
  verification: new VerificationService({
    verificationTokenRepository: accessRepositories.verificationToken,
    userRepository: accessRepositories.user,
    auditLog: accessInfrastructure.auditLog,
  }),
  twoFactor: new TwoFactorService({ redis }),
  pending2faLogin: new Pending2FALoginService({ redis }),
};

// Use Case Factories
export const accessUseCases = {
  login: () => new LoginUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    tokenService: accessServices.token,
    passwordService: accessServices.password,
    sessionService: accessServices.session,
    rateLimiterService: accessServices.rateLimiter,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
    pending2faLoginService: accessServices.pending2faLogin,
  }),
  
  logout: () => new LogoutUseCase({
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    authCache: accessCaches.auth,
    auditLog: accessInfrastructure.auditLog,
  }),
  
  refreshSession: () => new RefreshSessionUseCase({
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    tokenService: accessServices.token,
    sessionService: accessServices.session,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
    sessionSecurity: accessInfrastructure.sessionSecurity,
  }),
  
  inviteUser: () => new InviteUserUseCase({
    userRepository: accessRepositories.user,
    inviteRepository: accessRepositories.invite,
    roleRepository: accessRepositories.role,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),
  
  acceptInvite: () => new AcceptInviteUseCase({
    inviteRepository: accessRepositories.invite,
    passwordService: accessServices.password,
    auditLog: accessInfrastructure.auditLog,
  }),

  validateInvite: () => new ValidateInviteUseCase({
    inviteRepository: accessRepositories.invite,
  }),
  
  revokeInvite: () => new RevokeInviteUseCase({
    inviteRepository: accessRepositories.invite,
    auditLog: accessInfrastructure.auditLog,
  }),

  resendInvite: () => new ResendInviteUseCase({
    inviteRepository: accessRepositories.invite,
    inviteService: accessServices.invite,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),

  getInvitations: () => new GetInvitationsUseCase({
    inviteRepository: accessRepositories.invite,
    userRepository: accessRepositories.user,
  }),
  
  requestPasswordReset: () => new RequestPasswordResetUseCase({
    userRepository: accessRepositories.user,
    passwordResetRepository: accessRepositories.passwordReset,
    emailService: accessServices.email,
    messagingService: accessServices.messaging,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),
  
  resetPassword: () => new ResetPasswordUseCase({
    userRepository: accessRepositories.user,
    passwordResetRepository: accessRepositories.passwordReset,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
    passwordService: accessServices.password,
    notificationService: accessServices.notification,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),

  changePassword: () => new ChangePasswordUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
    passwordService: accessServices.password,
    auditLog: accessInfrastructure.auditLog,
  }),

  setup2fa: () => new Setup2FAUseCase({
    userRepository: accessRepositories.user,
    twoFactorService: accessServices.twoFactor,
  }),

  confirm2faSetup: () => new Confirm2FASetupUseCase({
    userRepository: accessRepositories.user,
    twoFactorService: accessServices.twoFactor,
    authCache: accessCaches.auth,
    auditLog: accessInfrastructure.auditLog,
  }),

  verify2faLogin: () => new Verify2FALoginUseCase({
    userRepository: accessRepositories.user,
    sessionCache: accessCaches.session,
    twoFactorService: accessServices.twoFactor,
    pending2faLoginService: accessServices.pending2faLogin,
    tokenService: accessServices.token,
    sessionService: accessServices.session,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),

  disable2fa: () => new Disable2FAUseCase({
    userRepository: accessRepositories.user,
    twoFactorService: accessServices.twoFactor,
    authCache: accessCaches.auth,
    passwordService: accessServices.password,
    auditLog: accessInfrastructure.auditLog,
  }),

  getCapabilities: () => new GetCapabilitiesUseCase({
    userRepository: accessRepositories.user,
    accessGrantService,
  }),
  
  deactivateUser: () => new DeactivateUserUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),
  
  activateUser: () => new ActivateUserUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
    auditLog: accessInfrastructure.auditLog,
  }),
  
  suspendUser: () => new SuspendUserUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),
  
  unsuspendUser: () => new UnsuspendUserUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
    auditLog: accessInfrastructure.auditLog,
  }),
  
  getUserSessions: () => new GetUserSessionsUseCase({
    sessionRepository: accessRepositories.session,
  }),
  
  revokeSession: () => new RevokeSessionUseCase({
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    auditLog: accessInfrastructure.auditLog,
  }),

  revokeOtherSessions: () => new RevokeOtherSessionsUseCase({
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    auditLog: accessInfrastructure.auditLog,
  }),

  changeUserRole: () => new ChangeUserRoleUseCase({
    userRepository: accessRepositories.user,
    roleRepository: accessRepositories.role,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
    metrics: accessInfrastructure.metrics,
  }),

  listRoles: () => new ListRolesUseCase({
    roleRepository: accessRepositories.role,
  }),

  listUsers: () => new ListUsersUseCase({
    userRepository: accessRepositories.user,
  }),

  updateProfile: () => new UpdateProfileUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
  }),

  assignUserManager: () => new AssignUserManagerUseCase({
    userRepository: accessRepositories.user,
    scopeRepository: accessRepositories.scope,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
  }),

  assignUserTerritory: () => new AssignUserTerritoryUseCase({
    userRepository: accessRepositories.user,
    scopeRepository: accessRepositories.scope,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
    territoryAssignmentPolicy,
  }),

  revokeUserTerritory: () => new RevokeUserTerritoryUseCase({
    userRepository: accessRepositories.user,
    scopeRepository: accessRepositories.scope,
    scopeService: accessScopeServices.scope,
    auditLog: accessInfrastructure.auditLog,
  }),

  getUserAssignments: () => new GetUserAssignmentsUseCase({
    userRepository: accessRepositories.user,
    scopeRepository: accessRepositories.scope,
  }),

  grantPermission: () => new GrantPermissionUseCase({
    accessGrantService,
    userRepository: accessRepositories.user,
  }),

  revokePermission: () => new RevokePermissionUseCase({
    accessGrantService,
  }),
};

// Plugins
export const auth = createAuthPlugin({
  tokenService: accessServices.token,
  sessionRepository: accessRepositories.session,
  userRepository: accessRepositories.user,
  authCacheService: accessCaches.auth,
  sessionCacheService: accessCaches.session,
  scopeService: accessScopeServices.scope,
  accessGrantService,
  redis,
});

/**
 * Example usage in routes:
 * 
 * import { accessUseCases, auth } from "../../composition";
 * 
 * const loginUseCase = accessUseCases.login();
 * const result = await loginUseCase.execute({ email, password });
 */
