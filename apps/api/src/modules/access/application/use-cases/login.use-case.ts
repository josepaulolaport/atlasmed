import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { PasswordService } from "../services/password.service";
import { SessionService } from "../services/session.service";
import { TokenService } from "../services/token.service";
import { RateLimiterService } from "../services/rate-limiter.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";
import {
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from "../../../../shared/errors";
import { environment } from "../../../../app/config/environment";

interface Dependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
  tokenService: TokenService;
  passwordService: PasswordService;
  sessionService: SessionService;
  rateLimiterService: RateLimiterService;
}

interface LoginParams {
  identifier: string;
  password: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  acceptLanguage?: string | undefined;
}

export class LoginUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: LoginParams) {
    try {
      await this.deps.rateLimiterService.checkLoginAttempts(params.identifier);
    } catch (error) {
      if (error instanceof TooManyLoginAttemptsError) {
        await auditLogService.logFailedLoginAttempt({
          identifier: params.identifier,
          reason: "rate_limited",
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
      }
      throw error;
    }

    const user = await this.deps.userRepository.findByIdentifier({
      identifier: params.identifier,
    });

    if (!user) {
      await this.deps.rateLimiterService.recordFailedAttempt(params.identifier);
      metricsService.recordLoginAttempt(false, "user_not_found");
      await auditLogService.logFailedLoginAttempt({
        identifier: params.identifier,
        reason: "user_not_found",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new InvalidCredentialsError();
    }

    if (user.status !== "ACTIVE") {
      const reason =
        user.status === "SUSPENDED"
          ? "account_suspended"
          : user.status === "INACTIVE"
            ? "account_deactivated"
            : user.status === "PENDING"
              ? "account_pending"
              : "account_inactive";

      metricsService.recordLoginAttempt(false, reason);
      await auditLogService.logFailedLoginAttempt({
        identifier: params.identifier,
        reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        userId: user.id,
      });
      throw new InvalidCredentialsError();
    }

    if (environment.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN && !user.emailVerified) {
      metricsService.recordLoginAttempt(false, "email_not_verified");
      await auditLogService.logFailedLoginAttempt({
        identifier: params.identifier,
        reason: "email_not_verified",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        userId: user.id,
      });
      throw new InvalidCredentialsError();
    }

    const validPassword = await this.deps.passwordService.verify(
      params.password,
      user.passwordHash,
    );

    if (!validPassword) {
      await this.deps.rateLimiterService.recordFailedAttempt(params.identifier);
      metricsService.recordLoginAttempt(false, "invalid_password");
      await auditLogService.logFailedLoginAttempt({
        identifier: params.identifier,
        reason: "invalid_password",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        userId: user.id,
      });
      throw new InvalidCredentialsError();
    }

    await this.deps.rateLimiterService.clearAttempts(params.identifier);

    await this.deps.userRepository.updateLastLogin(user.id);

    const session = await this.deps.sessionService.create({
      userId: user.id,

      userRole: user.role.name,

      ipAddress: params.ipAddress || undefined,

      userAgent: params.userAgent || undefined,

      acceptLanguage: params.acceptLanguage || undefined,
    });

    // Update cache with complete session including user data
    await this.deps.sessionCache.set({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() || null,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
        tokenVersion: user.tokenVersion,
        role: {
          id: user.role.id,
          name: user.role.name,
        },
      },
    });

    const accessToken = await this.deps.tokenService.signAccessToken({
      sub: user.id,

      sid: session.id,

      role: user.role.name,

      tokenVersion: user.tokenVersion,

      iat: Math.floor(Date.now() / 1000),
    });

    await auditLogService.logUserLogin({
      userId: user.id,
      sessionId: session.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    });

    metricsService.recordLoginAttempt(true);

    return {
      accessToken,

      refreshToken: session.refreshToken,

      user,
    };
  }
}
