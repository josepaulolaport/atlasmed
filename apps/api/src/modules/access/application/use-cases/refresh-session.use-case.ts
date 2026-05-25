import { UnauthorizedError } from "@atlasmed/access";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import { TokenService } from "../services/token.service";
import { SessionService } from "../services/session.service";
import { hashToken } from "../../../../shared/utils/hash-token";

interface Dependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
}

interface RefreshSessionParams {
  refreshToken: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class RefreshSessionUseCase {
  private readonly tokenService = new TokenService();
  private readonly sessionService: SessionService;

  constructor(private readonly deps: Dependencies) {
    this.sessionService = new SessionService({ 
      sessionRepository: deps.sessionRepository,
      sessionCache: deps.sessionCache,
    });
  }

  async execute(params: RefreshSessionParams) {
    const tokenHash = hashToken(params.refreshToken);

    let oldSession = await this.deps.sessionCache.getByTokenHash(tokenHash);

    if (!oldSession) {
      const dbSession = await this.deps.sessionRepository.findActiveByTokenHash(tokenHash);

      if (!dbSession) {
        throw new UnauthorizedError();
      }

      oldSession = {
        id: dbSession.id,
        userId: dbSession.userId,
        refreshTokenHash: dbSession.refreshTokenHash,
        expiresAt: dbSession.expiresAt.toISOString(),
        revokedAt: dbSession.revokedAt?.toISOString() || null,
        ipAddress: dbSession.ipAddress,
        userAgent: dbSession.userAgent,
        lastSeenAt: dbSession.lastSeenAt.toISOString(),
        createdAt: dbSession.createdAt.toISOString(),
        user: {
          id: dbSession.user.id,
          email: dbSession.user.email,
          username: dbSession.user.username,
          status: dbSession.user.status,
          tokenVersion: dbSession.user.tokenVersion,
          role: {
            id: dbSession.user.role.id,
            name: dbSession.user.role.name,
          },
        },
      };

      await this.deps.sessionCache.set(oldSession);
    }

    if (!oldSession || !oldSession.user) {
      throw new UnauthorizedError();
    }

    if (oldSession.user.status !== "ACTIVE") {
      throw new UnauthorizedError();
    }

    const newSessionData = await this.sessionService.create({
      userId: oldSession.userId,
      userRole: oldSession.user.role.name as any,
      ipAddress: params.ipAddress || undefined,
      userAgent: params.userAgent || undefined,
    });

    const newSession = await this.deps.sessionRepository.rotateSessionTransaction({
      oldSessionId: oldSession.id,
      newSessionId: newSessionData.id,
      newRefreshTokenHash: hashToken(newSessionData.refreshToken),
      newExpiresAt: newSessionData.expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await this.deps.sessionCache.invalidate(oldSession.id);

    const accessToken = await this.tokenService.signAccessToken({
      sub: newSession.userId,
      sid: newSession.id,
      role: newSession.user.role.name,
      tokenVersion: newSession.user.tokenVersion,
      iat: Math.floor(Date.now() / 1000),
    });

    return {
      accessToken,
      refreshToken: newSessionData.refreshToken,
      user: newSession.user,
    };
  }
}
