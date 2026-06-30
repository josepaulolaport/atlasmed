import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { TwoFactorService } from "../services/two-factor.service";
import type { Pending2FALoginService } from "../services/pending-2fa-login.service";
import { SessionService } from "../services/session.service";
import { TokenService } from "../services/token.service";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { IMetrics } from "../interfaces/metrics.interface";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  TokenInvalidError,
  UserNotFoundError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  sessionCache: ISessionCache;
  twoFactorService: TwoFactorService;
  pending2faLoginService: Pending2FALoginService;
  tokenService: TokenService;
  sessionService: SessionService;
  auditLog: IAuditLog;
  metrics: IMetrics;
}

export class Verify2FALoginUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    pendingToken: string;
    code: string;
    ipAddress?: string;
    userAgent?: string;
    acceptLanguage?: string;
  }) {
    const pendingLogin = await this.deps.pending2faLoginService.get(
      params.pendingToken
    );

    const user = await this.deps.userRepository.findById(pendingLogin.userId);

    if (!user || user.status !== "ACTIVE") {
      throw new InvalidCredentialsError();
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new OperationNotAllowedError(
        "verify_2fa_login",
        "Two-factor authentication is not enabled for this account"
      );
    }

    const secret = this.deps.twoFactorService.decryptSecret(user.twoFactorSecret);
    const valid = await this.deps.twoFactorService.verifyTotp(params.code, secret);

    if (!valid) {
      const attemptsRemaining =
        await this.deps.pending2faLoginService.recordFailedAttempt(
          params.pendingToken
        );

      this.deps.metrics.recordLoginAttempt(false, "invalid_2fa_code");
      await this.deps.auditLog.logFailedLoginAttempt({
        identifier: user.email,
        reason: attemptsRemaining
          ? "invalid_2fa_code"
          : "invalid_2fa_code_max_attempts",
        ipAddress: params.ipAddress ?? pendingLogin.ipAddress,
        userAgent: params.userAgent ?? pendingLogin.userAgent,
        userId: user.id,
      });

      if (!attemptsRemaining) {
        throw new TokenInvalidError();
      }

      throw new InvalidCredentialsError();
    }

    const acquired = await this.deps.pending2faLoginService.acquireVerificationLock(
      params.pendingToken
    );

    if (!acquired) {
      throw new TokenInvalidError();
    }

    await this.deps.pending2faLoginService.consume(params.pendingToken);

    await this.deps.userRepository.updateLastLogin(user.id);

    const session = await this.deps.sessionService.create({
      userId: user.id,
      userRole: user.role.name,
      ipAddress: params.ipAddress ?? pendingLogin.ipAddress,
      userAgent: params.userAgent ?? pendingLogin.userAgent,
      acceptLanguage: params.acceptLanguage ?? pendingLogin.acceptLanguage,
    });

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

    await this.deps.auditLog.logSessionCreate({
      userId: user.id,
      sessionId: session.id,
      ipAddress: params.ipAddress ?? pendingLogin.ipAddress,
      userAgent: params.userAgent ?? pendingLogin.userAgent,
    });

    await this.deps.auditLog.logUserLogin({
      userId: user.id,
      sessionId: session.id,
      ipAddress: params.ipAddress ?? pendingLogin.ipAddress,
      userAgent: params.userAgent ?? pendingLogin.userAgent,
      success: true,
    });

    this.deps.metrics.recordLoginAttempt(true);

    return {
      accessToken,
      refreshToken: session.refreshToken,
      user,
    };
  }
}
