/**
 * Composition Root for Access Module
 * 
 * This file centralizes dependency injection for the access module.
 * All dependencies are wired here and exported as factory functions.
 * 
 * Benefits:
 * - Single place to manage all dependencies
 * - Easier testing (can inject mocks)
 * - Clear dependency graph
 * - Prevents scattered "new" keywords throughout the codebase
 */

import { redis } from "../../infrastructure/cache/redis.client";
import { prisma } from "../../infrastructure/database/prisma.client";

// Repositories
import { PrismaUserRepository } from "./infrastructure/repositories/prisma/prisma-user.repository";
import { PrismaInviteRepository } from "./infrastructure/repositories/prisma/prisma-invite.repository";
import { PrismaSessionRepository } from "./infrastructure/repositories/prisma/prisma-session.repository";
import { PrismaPasswordResetRepository } from "./infrastructure/repositories/prisma/prisma-password-reset.repository";

// Cache Services
import { AuthCacheService } from "./infrastructure/cache/auth-cache.service";
import { SessionCacheService } from "./infrastructure/cache/session-cache.service";

// Services
import { TokenService } from "./application/services/token.service";
import { PasswordService } from "./application/services/password.service";
import { SessionService } from "./application/services/session.service";
import { InviteService } from "./application/services/invite.service";
import { PasswordResetService } from "./application/services/password-reset.service";
import { RateLimiterService } from "./application/services/rate-limiter.service";
import { NotificationService } from "./application/services/notification.service";

// Use Cases
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case";
import { InviteUserUseCase } from "./application/use-cases/invite-user.use-case";
import { AcceptInviteUseCase } from "./application/use-cases/accept-invite.use-case";
import { RevokeInviteUseCase } from "./application/use-cases/revoke-invite.use-case";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { DeactivateUserUseCase } from "./application/use-cases/deactivate-user.use-case";
import { ActivateUserUseCase } from "./application/use-cases/activate-user.use-case";
import { SuspendUserUseCase } from "./application/use-cases/suspend-user.use-case";
import { UnsuspendUserUseCase } from "./application/use-cases/unsuspend-user.use-case";

// Singletons - Infrastructure
export const accessRepositories = {
  user: new PrismaUserRepository(),
  invite: new PrismaInviteRepository(),
  session: new PrismaSessionRepository(),
  passwordReset: new PrismaPasswordResetRepository({ prisma }),
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
  passwordReset: new PasswordResetService({ passwordResetRepository: accessRepositories.passwordReset }),
  rateLimiter: new RateLimiterService({ redis }),
  notification: new NotificationService(),
};

// Use Case Factories
export const accessUseCases = {
  login: () => new LoginUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
    redis,
  }),
  
  logout: () => new LogoutUseCase({
    sessionRepository: accessRepositories.session,
  }),
  
  refreshSession: () => new RefreshSessionUseCase({
    sessionRepository: accessRepositories.session,
    sessionCache: accessCaches.session,
  }),
  
  inviteUser: () => new InviteUserUseCase({
    userRepository: accessRepositories.user,
    inviteRepository: accessRepositories.invite,
  }),
  
  acceptInvite: () => new AcceptInviteUseCase({
    inviteRepository: accessRepositories.invite,
  }),
  
  revokeInvite: () => new RevokeInviteUseCase({
    inviteRepository: accessRepositories.invite,
  }),
  
  requestPasswordReset: () => new RequestPasswordResetUseCase({
    userRepository: accessRepositories.user,
    passwordResetRepository: accessRepositories.passwordReset,
  }),
  
  resetPassword: () => new ResetPasswordUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
  }),
  
  deactivateUser: () => new DeactivateUserUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
  }),
  
  activateUser: () => new ActivateUserUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
  }),
  
  suspendUser: () => new SuspendUserUseCase({
    userRepository: accessRepositories.user,
    sessionRepository: accessRepositories.session,
    authCache: accessCaches.auth,
    sessionCache: accessCaches.session,
  }),
  
  unsuspendUser: () => new UnsuspendUserUseCase({
    userRepository: accessRepositories.user,
    authCache: accessCaches.auth,
  }),
};

/**
 * Example usage in routes:
 * 
 * import { accessUseCases } from "../../composition";
 * 
 * const loginUseCase = accessUseCases.login();
 * const result = await loginUseCase.execute({ email, password });
 */
