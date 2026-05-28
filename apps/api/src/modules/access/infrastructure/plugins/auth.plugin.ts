import { Elysia } from "elysia";
import {
  AppError,
  UnauthorizedError,
  AccountSuspendedError,
  AccountDeactivatedError,
  AccountPendingError,
} from "../../../../shared/errors";
import type { TokenService } from "../../application/services/token.service";
import type { SessionRepository } from "../../application/interfaces/session.repository.interface";
import type { UserRepository } from "../../application/interfaces/user.repository.interface";
import type { AuthCacheService } from "../cache/auth-cache.service";
import type { SessionCacheService } from "../cache/session-cache.service";
import type { ScopeService } from "../../application/services/scope.service";
import type { AccessGrantService } from "../../application/services/access-grant.service";
import type { Redis } from "ioredis";
import { logger } from "../../../../infrastructure/logging/logger";
import { getClientIp } from "../../../../shared/utils/client-ip";

const LAST_SEEN_THRESHOLD = 5 * 60 * 1000;

function assertActiveUserStatus(
  status: string,
  userId: string,
  ipAddress: string
): void {
  if (status === "ACTIVE") {
    return;
  }

  logger.warn({ userId, status, ipAddress }, "Inactive user attempted access");

  switch (status) {
    case "SUSPENDED":
      throw new AccountSuspendedError();
    case "INACTIVE":
      throw new AccountDeactivatedError();
    case "PENDING":
      throw new AccountPendingError();
    default:
      throw new UnauthorizedError();
  }
}

export interface AuthPluginDependencies {
  tokenService: TokenService;
  sessionRepository: SessionRepository;
  userRepository: UserRepository;
  authCacheService: AuthCacheService;
  sessionCacheService: SessionCacheService;
  scopeService: ScopeService;
  accessGrantService: AccessGrantService;
  redis: Redis;
}

type AccessTokenPayload = {
  sub: string;
  sid: string;
  tokenVersion: number;
  role?: string;
};

type AuthContext = {
  userId: string;
  sessionId: string;
  roleId: string;
  roleName: string;
  status: string;
};

async function resolveAccessSessionFromToken(
  token: string,
  ipAddress: string,
  dependencies: AuthPluginDependencies
): Promise<AuthContext> {
  const { 
    tokenService, 
    sessionRepository, 
    userRepository, 
    authCacheService, 
    sessionCacheService, 
    redis 
  } = dependencies;

  const payload = await tokenService.verifyAccessToken(token) as AccessTokenPayload;

  let session = await sessionCacheService.getById(payload.sid);

  if (!session) {
    const dbSession = await sessionRepository.findById(payload.sid);

    if (!dbSession) {
      logger.warn(
        { sessionId: payload.sid, userId: payload.sub, ipAddress },
        "Session not found"
      );
      throw new UnauthorizedError();
    }

    if (payload.sub !== dbSession.userId) {
      logger.warn(
        {
          sessionId: payload.sid,
          jwtUserId: payload.sub,
          sessionUserId: dbSession.userId,
          ipAddress,
        },
        "Session user mismatch"
      );
      throw new UnauthorizedError();
    }

    session = {
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

    await sessionCacheService.set(session);
    await sessionCacheService.markValidated(payload.sid);
  } else {
    if (await sessionCacheService.isMarkedRevoked(payload.sid)) {
      logger.warn(
        { sessionId: payload.sid, userId: payload.sub, ipAddress },
        "Revoked session marker found for cached session"
      );
      await sessionCacheService.invalidate(payload.sid);
      throw new UnauthorizedError();
    }

    if (!(await sessionCacheService.isRecentlyValidated(payload.sid))) {
      const dbStatus = await sessionRepository.findSessionStatus(payload.sid);

      if (!dbStatus) {
        logger.warn(
          { sessionId: payload.sid, userId: payload.sub, ipAddress },
          "Session not found in DB but present in cache"
        );
        await sessionCacheService.invalidate(payload.sid);
        throw new UnauthorizedError();
      }

      if (payload.sub !== dbStatus.userId || payload.sub !== session.userId) {
        logger.warn(
          {
            sessionId: payload.sid,
            jwtUserId: payload.sub,
            sessionUserId: session.userId,
            dbUserId: dbStatus.userId,
            ipAddress,
          },
          "Session user mismatch"
        );
        await sessionCacheService.invalidate(payload.sid);
        throw new UnauthorizedError();
      }

      const dbRevoked = dbStatus.revokedAt !== null;
      const dbExpired = dbStatus.expiresAt < new Date();

      if (dbRevoked || dbExpired) {
        logger.warn(
          {
            sessionId: payload.sid,
            userId: payload.sub,
            dbRevoked,
            dbExpired,
            cachedRevokedAt: session.revokedAt,
            cachedExpiresAt: session.expiresAt,
            ipAddress,
          },
          "Stale cached session rejected after DB revalidation"
        );
        await sessionCacheService.invalidate(payload.sid);
        throw new UnauthorizedError();
      }

      await sessionCacheService.markValidated(payload.sid);
    }
  }

  if (session.revokedAt) {
    logger.warn(
      {
        sessionId: payload.sid,
        userId: payload.sub,
        revokedAt: session.revokedAt,
        ipAddress,
      },
      "Revoked session attempted"
    );
    throw new UnauthorizedError();
  }

  if (new Date(session.expiresAt) < new Date()) {
    logger.warn(
      {
        sessionId: payload.sid,
        userId: payload.sub,
        expiresAt: session.expiresAt,
        ipAddress,
      },
      "Expired session attempted"
    );
    throw new UnauthorizedError();
  }

  let authContext = await authCacheService.get(payload.sub);

  if (!authContext) {
    const user = await userRepository.findById(payload.sub);

    if (!user) {
      logger.warn(
        { userId: payload.sub, sessionId: payload.sid, ipAddress },
        "User not found for valid session"
      );
      throw new UnauthorizedError();
    }

    authContext = {
      userId: user.id,
      roleId: user.role.id,
      roleName: user.role.name,
      status: user.status,
      tokenVersion: user.tokenVersion,
    };

    await authCacheService.set(user.id, authContext);
    await authCacheService.markValidated(user.id);
  } else if (!(await authCacheService.isRecentlyValidated(payload.sub))) {
    const dbAuthStatus = await userRepository.findUserAuthStatus(payload.sub);

    if (!dbAuthStatus) {
      logger.warn(
        { userId: payload.sub, sessionId: payload.sid, ipAddress },
        "User not found in DB but present in auth cache"
      );
      await authCacheService.invalidate(payload.sub);
      throw new UnauthorizedError();
    }

    const authStatusChanged =
      authContext.status !== dbAuthStatus.status ||
      authContext.tokenVersion !== dbAuthStatus.tokenVersion ||
      authContext.roleId !== dbAuthStatus.roleId ||
      authContext.roleName !== dbAuthStatus.roleName;

    if (authStatusChanged) {
      logger.warn(
        {
          userId: payload.sub,
          sessionId: payload.sid,
          cachedStatus: authContext.status,
          dbStatus: dbAuthStatus.status,
          cachedTokenVersion: authContext.tokenVersion,
          dbTokenVersion: dbAuthStatus.tokenVersion,
          ipAddress,
        },
        "Stale auth cache corrected after DB revalidation"
      );

      authContext = {
        userId: payload.sub,
        roleId: dbAuthStatus.roleId,
        roleName: dbAuthStatus.roleName,
        status: dbAuthStatus.status,
        tokenVersion: dbAuthStatus.tokenVersion,
      };

      await authCacheService.set(payload.sub, authContext);
    }

    await authCacheService.markValidated(payload.sub);
  }

  if (payload.tokenVersion !== authContext.tokenVersion) {
    logger.warn(
      {
        userId: payload.sub,
        sessionId: payload.sid,
        jwtVersion: payload.tokenVersion,
        currentVersion: authContext.tokenVersion,
        ipAddress,
      },
      "Token version mismatch - token invalidated"
    );
    throw new UnauthorizedError();
  }

  if (payload.role && payload.role !== authContext.roleName) {
    logger.warn(
      {
        userId: payload.sub,
        sessionId: payload.sid,
        jwtRole: payload.role,
        dbRole: authContext.roleName,
        ipAddress,
      },
      "JWT role mismatch with DB"
    );
    throw new UnauthorizedError();
  }

  assertActiveUserStatus(authContext.status, payload.sub, ipAddress);

  const lastSeenKey = `session:${payload.sid}:lastSeen`;
  const lastSeenCache = await redis.get(lastSeenKey);
  
  if (!lastSeenCache) {
    sessionRepository.updateLastSeen(payload.sid).catch((error) => {
      logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to update lastSeen"
      );
    });
    sessionCacheService.updateLastSeen(payload.sid).catch((error) => {
      logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to update lastSeen in cache"
      );
    });
    redis.setex(lastSeenKey, 300, Date.now().toString()).catch((error) => {
      logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to cache lastSeen"
      );
    });
  } else {
    const lastSeenTime = parseInt(lastSeenCache, 10);
    const timeSinceLastUpdate = Date.now() - lastSeenTime;
    
    if (timeSinceLastUpdate > LAST_SEEN_THRESHOLD) {
      sessionRepository.updateLastSeen(payload.sid).catch((error) => {
        logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to update lastSeen"
      );
      });
      sessionCacheService.updateLastSeen(payload.sid).catch((error) => {
        logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to update lastSeen in cache"
      );
      });
      redis.setex(lastSeenKey, 300, Date.now().toString()).catch((error) => {
        logger.error(
        { sessionId: payload.sid, error: error.message },
        "Failed to cache lastSeen"
      );
      });
    }
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
    roleId: authContext.roleId,
    roleName: authContext.roleName,
    status: authContext.status,
  };
}

export function createAuthPlugin(dependencies: AuthPluginDependencies) {
  const { userRepository, scopeService, accessGrantService } = dependencies;

  return new Elysia({ name: "auth" })
    .derive({ as: "scoped" }, async ({ request }) => {
      const authHeader = request.headers.get("authorization");
      const ipAddress = getClientIp(request);

      if (!authHeader?.startsWith("Bearer ")) {
        logger.warn({ ipAddress }, "Missing or invalid authorization header");
        throw new UnauthorizedError();
      }

      const token = authHeader.substring(7);

      try {
        const authContext = await resolveAccessSessionFromToken(token, ipAddress, dependencies);

        return {
          getAuthContext: async () => authContext,
          getUserId: async () => authContext.userId,
          getSessionId: async () => authContext.sessionId,
          getScope: async () =>
            scopeService.resolve(authContext.userId, authContext.roleName),
          getUser: async () => {
            const user = await userRepository.findById(authContext.userId);
            if (!user) {
              throw new UnauthorizedError();
            }
            return user;
          },
          getAccessGrants: async () =>
            accessGrantService.getActiveGrants(authContext.userId),
        };
      } catch (error) {
        if (error instanceof UnauthorizedError || error instanceof AppError) {
          throw error;
        }

        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ipAddress,
          },
          "Auth plugin unexpected error"
        );
        
        throw new UnauthorizedError();
      }
    });
}
