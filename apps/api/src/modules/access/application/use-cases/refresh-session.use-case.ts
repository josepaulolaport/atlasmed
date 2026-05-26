import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import { TokenService } from "../services/token.service";
import { SessionService } from "../services/session.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";
import { sessionSecurityService } from "../../../../infrastructure/security/session-security.service";
import { hashToken } from "../../../../shared/utils/hash-token";
import { generateDeviceFingerprint } from "../../../../shared/utils/device-fingerprint";
import {
  AccountSuspendedError,
  AccountDeactivatedError,
  AccountPendingError,
  TokenInvalidError,
  RefreshTokenReuseDetectedError,
  SessionSecurityViolationError,
} from "../../../../shared/errors";

interface Dependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
  tokenService: TokenService;
  sessionService: SessionService;
}

interface RefreshSessionParams {
  refreshToken: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  acceptLanguage?: string | undefined;
}

export class RefreshSessionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: RefreshSessionParams) {
    const tokenHash = hashToken(params.refreshToken);

    let oldSession = await this.deps.sessionCache.getByTokenHash(tokenHash);
    let dbSessionRecord: Awaited<
      ReturnType<SessionRepository["findActiveByTokenHash"]>
    > | null = null;

    if (!oldSession) {
      dbSessionRecord =
        await this.deps.sessionRepository.findActiveByTokenHash(tokenHash);

      if (!dbSessionRecord) {
        const superseded =
          await this.deps.sessionCache.getSupersededSession(tokenHash);

        if (superseded) {
          await this.handleRefreshTokenReuse({
            userId: superseded.userId,
            sessionId: superseded.sessionId,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
          });
        }

        throw new TokenInvalidError("Refresh token not found or expired");
      }

      oldSession = {
        id: dbSessionRecord.id,
        userId: dbSessionRecord.userId,
        refreshTokenHash: dbSessionRecord.refreshTokenHash,
        expiresAt: dbSessionRecord.expiresAt.toISOString(),
        revokedAt: dbSessionRecord.revokedAt?.toISOString() || null,
        ipAddress: dbSessionRecord.ipAddress,
        userAgent: dbSessionRecord.userAgent,
        lastSeenAt: dbSessionRecord.lastSeenAt.toISOString(),
        createdAt: dbSessionRecord.createdAt.toISOString(),
        user: {
          id: dbSessionRecord.user.id,
          email: dbSessionRecord.user.email,
          username: dbSessionRecord.user.username,
          status: dbSessionRecord.user.status,
          tokenVersion: dbSessionRecord.user.tokenVersion,
          role: {
            id: dbSessionRecord.user.role.id,
            name: dbSessionRecord.user.role.name,
          },
        },
      };

      await this.deps.sessionCache.set(oldSession);
    }

    if (!oldSession?.user) {
      throw new TokenInvalidError("Invalid session data");
    }

    if (oldSession.user.status === "SUSPENDED") {
      throw new AccountSuspendedError();
    }

    if (oldSession.user.status === "INACTIVE") {
      throw new AccountDeactivatedError();
    }

    if (oldSession.user.status === "PENDING") {
      throw new AccountPendingError();
    }

    if (oldSession.user.status !== "ACTIVE") {
      throw new TokenInvalidError("Account is not active");
    }

    await this.validateSessionSecurity({
      userId: oldSession.userId,
      sessionId: oldSession.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      acceptLanguage: params.acceptLanguage,
      sessionIpAddress: oldSession.ipAddress,
      sessionUserAgent: oldSession.userAgent,
      sessionDeviceFingerprint: dbSessionRecord?.deviceFingerprint ?? null,
      loadDeviceFingerprintFromDb: !dbSessionRecord,
    });

    const refreshCredentials = this.deps.sessionService.buildRefreshCredentials({
      userRole: oldSession.user.role.name as any,
    });

    let updatedSession;

    try {
      updatedSession =
        await this.deps.sessionRepository.rotateRefreshTokenTransaction({
          sessionId: oldSession.id,
          expectedRefreshTokenHash: tokenHash,
          newRefreshTokenHash: refreshCredentials.refreshTokenHash,
          newExpiresAt: refreshCredentials.expiresAt,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
    } catch (error) {
      if (error instanceof RefreshTokenReuseDetectedError) {
        await this.handleRefreshTokenReuse({
          userId: error.context?.userId as string,
          sessionId: error.context?.sessionId as string,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
      }

      throw error;
    }

    const cachedSession = {
      id: updatedSession.id,
      userId: updatedSession.userId,
      refreshTokenHash: updatedSession.refreshTokenHash,
      expiresAt: updatedSession.expiresAt.toISOString(),
      revokedAt: null,
      ipAddress: updatedSession.ipAddress,
      userAgent: updatedSession.userAgent,
      lastSeenAt: updatedSession.lastSeenAt.toISOString(),
      createdAt: updatedSession.createdAt.toISOString(),
      user: {
        id: updatedSession.user.id,
        email: updatedSession.user.email,
        username: updatedSession.user.username,
        status: updatedSession.user.status,
        tokenVersion: updatedSession.user.tokenVersion,
        role: {
          id: updatedSession.user.role.id,
          name: updatedSession.user.role.name,
        },
      },
    };

    await this.deps.sessionCache.updateAfterRefresh(cachedSession, tokenHash);

    const accessToken = await this.deps.tokenService.signAccessToken({
      sub: updatedSession.userId,
      sid: updatedSession.id,
      role: updatedSession.user.role.name,
      tokenVersion: updatedSession.user.tokenVersion,
      iat: Math.floor(Date.now() / 1000),
    });

    return {
      accessToken,
      refreshToken: refreshCredentials.refreshToken,
      user: updatedSession.user,
    };
  }

  private async validateSessionSecurity(params: {
    userId: string;
    sessionId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    acceptLanguage?: string | undefined;
    sessionIpAddress: string | null;
    sessionUserAgent: string | null;
    sessionDeviceFingerprint: string | null;
    loadDeviceFingerprintFromDb: boolean;
  }): Promise<void> {
    let sessionDeviceFingerprint = params.sessionDeviceFingerprint;

    if (params.loadDeviceFingerprintFromDb) {
      const fullSession = await this.deps.sessionRepository.findById(
        params.sessionId
      );
      sessionDeviceFingerprint = fullSession?.deviceFingerprint ?? null;
    }

    const deviceFingerprint =
      params.userAgent || params.acceptLanguage
        ? generateDeviceFingerprint({
            userAgent: params.userAgent,
            acceptLanguage: params.acceptLanguage,
          })
        : undefined;

    const securityResult = await sessionSecurityService.validateSessionSecurity({
      userId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceFingerprint,
      sessionIpAddress: params.sessionIpAddress ?? undefined,
      sessionUserAgent: params.sessionUserAgent ?? undefined,
      sessionDeviceFingerprint: sessionDeviceFingerprint ?? undefined,
    });

    if (!securityResult.valid) {
      await this.deps.sessionService.revokeForSecurityViolation(params.sessionId);
      throw new SessionSecurityViolationError(securityResult.reason);
    }
  }

  private async handleRefreshTokenReuse(params: {
    userId: string;
    sessionId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<never> {
    await this.deps.sessionService.revokeAllByUserId(params.userId);

    await auditLogService.logSuspiciousActivity({
      userId: params.userId,
      sessionId: params.sessionId,
      reason: "refresh_token_reuse",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    metricsService.recordSuspiciousActivity("refresh_token_reuse");

    throw new RefreshTokenReuseDetectedError({
      userId: params.userId,
      sessionId: params.sessionId,
    });
  }
}
