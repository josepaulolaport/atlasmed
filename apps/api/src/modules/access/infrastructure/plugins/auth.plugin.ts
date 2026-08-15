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
import type { Redis } from "ioredis";
import { logger } from "../../../../infrastructure/logging/logger";
import { getClientIp } from "../../../../shared/utils/client-ip";
import { readVerticalIdHeader, resolveVerticalIds } from "../../application/services/vertical-access.service";
import { parseCrmId } from "../../../../shared/utils/parse-crm-id";

function assertActiveUserStatus(
  status: string,
  userId: number,
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
  redis: Redis;
}

type AccessTokenPayload = {
  sub: string;
  sid: string;
  tokenVersion: number;
  role?: string;
};

type AuthContext = {
  userId: number;
  sessionId: number;
  roleId: number;
  roleName: string;
  status: string;
};

/**
 * The header a client sets on a request that followed a real interaction
 * (spec 0015 §4.1).
 *
 * `last_seen_at` exists to answer "is this person still using the app". The
 * token refresh runs on an 8-minute timer, so counting every authenticated
 * request would keep an untouched phone looking alive indefinitely — the field
 * would say what it does not mean.
 *
 * Client-declared, and deliberately so: this is telemetry about our own reps,
 * not an authorisation input, so nothing turns on it being unforgeable. A build
 * that never sends it simply stops moving the field, which is the honest
 * failure — better than silently reporting timer traffic as activity.
 */
const CLIENT_ACTIVITY_HEADER = "x-client-activity";

/**
 * How stale the cached timestamp must be before it is worth a write.
 *
 * Compared in memory against the session we already hold, so the common request
 * costs nothing at all — no Redis round-trip, no query. Two instances deciding
 * to write at once is harmless: they write near-identical timestamps and the
 * last one wins, so there is nothing here to serialise.
 */
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

function isLastSeenStale(lastSeenAt: string | Date | null | undefined): boolean {
  if (!lastSeenAt) return true;
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return true;
  return Date.now() - seen >= LAST_SEEN_REFRESH_MS;
}

async function resolveAccessSessionFromToken(
  token: string,
  ipAddress: string,
  dependencies: AuthPluginDependencies,
  isUserActivity = false,
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
  const userId = parseCrmId(payload.sub, "user id");
  const sessionId = parseCrmId(payload.sid, "session id");

  let session = await sessionCacheService.getById(sessionId);

  if (!session) {
    const dbSession = await sessionRepository.findById(sessionId);

    if (!dbSession) {
      logger.warn(
        { sessionId: payload.sid, userId: payload.sub, ipAddress },
        "Session not found"
      );
      throw new UnauthorizedError();
    }

    if (userId !== dbSession.userId) {
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
      lastSeenAt: (dbSession.lastSeenAt ?? new Date()).toISOString(),
      createdAt: dbSession.createdAt.toISOString(),
      user: {
        id: dbSession.user.id,
        email: dbSession.user.email!,
        username: dbSession.user.username,
        status: dbSession.user.status,
        tokenVersion: dbSession.user.tokenVersion,
        role: {
          id: dbSession.user.role.id,
          name: dbSession.user.role.name,
        },
      },
    };

    await sessionCacheService.set(session!);
    await sessionCacheService.markValidated(sessionId);

    // A revoked marker can be left behind by a transient false-positive
    // (e.g. a DB hiccup during revalidation) while this exact session is
    // re-fetched here and confirmed healthy. Clear it so it can't outlive
    // the situation that (incorrectly) set it — otherwise it self-renews
    // its TTL forever every time a request hits it.
    if (!session.revokedAt) {
      await sessionCacheService.clearRevoked(sessionId);
    }
  } else {
    if (await sessionCacheService.isMarkedRevoked(sessionId)) {
      const dbStatus = await sessionRepository.findSessionStatus(sessionId);

      const dbConfirmsRevoked =
        !dbStatus ||
        dbStatus.revokedAt !== null ||
        dbStatus.expiresAt < new Date() ||
        userId !== dbStatus.userId ||
        userId !== session.userId;

      if (dbConfirmsRevoked) {
        logger.warn(
          { sessionId: payload.sid, userId: payload.sub, ipAddress },
          "Revoked session marker confirmed by DB revalidation"
        );
        await sessionCacheService.invalidate(sessionId);
        throw new UnauthorizedError();
      }

      // The marker was stale — DB revalidation says this session is still
      // healthy. Self-heal instead of rejecting a legitimate session
      // forever: clear the marker so it doesn't keep renewing itself on
      // every subsequent request.
      logger.warn(
        { sessionId: payload.sid, userId: payload.sub, ipAddress },
        "Cleared stale revoked marker after DB confirmed session is healthy"
      );
      await sessionCacheService.clearRevoked(sessionId);
      await sessionCacheService.markValidated(sessionId);
    } else if (!(await sessionCacheService.isRecentlyValidated(sessionId))) {
      const dbStatus = await sessionRepository.findSessionStatus(sessionId);

      if (!dbStatus) {
        logger.warn(
          { sessionId: payload.sid, userId: payload.sub, ipAddress },
          "Session not found in DB but present in cache"
        );
        await sessionCacheService.invalidate(sessionId);
        throw new UnauthorizedError();
      }

      if (userId !== dbStatus.userId || userId !== session.userId) {
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
        await sessionCacheService.invalidate(sessionId);
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
        await sessionCacheService.invalidate(sessionId);
        throw new UnauthorizedError();
      }

      await sessionCacheService.markValidated(sessionId);
    }
  }

  if (!session) {
    throw new UnauthorizedError();
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

  let authContext = await authCacheService.get(userId);

  if (!authContext) {
    const user = await userRepository.findById(userId);

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
  } else if (!(await authCacheService.isRecentlyValidated(userId))) {
    const dbAuthStatus = await userRepository.findUserAuthStatus(userId);

    if (!dbAuthStatus) {
      logger.warn(
        { userId: payload.sub, sessionId: payload.sid, ipAddress },
        "User not found in DB but present in auth cache"
      );
      await authCacheService.invalidate(userId);
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
        userId,
        roleId: dbAuthStatus.roleId,
        roleName: dbAuthStatus.roleName,
        status: dbAuthStatus.status,
        tokenVersion: dbAuthStatus.tokenVersion,
      };

      await authCacheService.set(userId, authContext);
    }

    await authCacheService.markValidated(userId);
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

  assertActiveUserStatus(authContext.status, userId, ipAddress);

  // Spec 0015 §4.1. Fire-and-forget: nothing on this request depends on it and
  // a slow write must not sit in front of the response. Failures are logged
  // rather than swallowed — a last-seen that quietly stopped moving would read
  // as a team that stopped working.
  if (isUserActivity && isLastSeenStale(session.lastSeenAt)) {
    void Promise.all([
      sessionRepository.updateLastSeen(sessionId),
      sessionCacheService.updateLastSeen(sessionId),
    ]).catch((error) => {
      logger.error(
        { err: error, sessionId: payload.sid, userId },
        "Failed to refresh session last_seen_at",
      );
    });
  }

  return {
    userId,
    sessionId,
    roleId: authContext.roleId,
    roleName: authContext.roleName,
    status: authContext.status,
  };
}

export function createAuthPlugin(dependencies: AuthPluginDependencies) {
  const { userRepository, scopeService } = dependencies;

  return new Elysia({ name: "auth" })
    .derive({ as: "scoped" }, async ({ request, server }) => {
      const authHeader = request.headers.get("authorization");
      const ipAddress = getClientIp({ request, server });

      if (!authHeader?.startsWith("Bearer ")) {
        logger.warn({ ipAddress }, "Missing or invalid authorization header");
        throw new UnauthorizedError();
      }

      const token = authHeader.substring(7);

      try {
        const authContext = await resolveAccessSessionFromToken(
          token,
          ipAddress,
          dependencies,
          request.headers.get(CLIENT_ACTIVITY_HEADER) === "1",
        );

        const headerVerticalId = readVerticalIdHeader(request.headers);

        return {
          getAuthContext: async () => authContext,
          getUserId: async () => authContext.userId,
          getSessionId: async () => authContext.sessionId,
          getRequestVerticalId: async () => headerVerticalId,
          getScope: async () => {
            const scope = await scopeService.resolve(
              authContext.userId,
              authContext.roleName
            );
            if (!headerVerticalId) {
              return { ...scope, activeVerticalId: null };
            }
            // Validate filter ⊆ token assigns (throws ForbiddenError).
            resolveVerticalIds({
              role: authContext.roleName,
              assignedVerticalIds: scope.assignedVerticalIds ?? [],
              headerVerticalId,
            });
            return { ...scope, activeVerticalId: headerVerticalId };
          },
          getUser: async () => {
            const user = await userRepository.findById(authContext.userId);
            if (!user) {
              throw new UnauthorizedError();
            }
            return user;
          },
        };
      } catch (error) {
        // Domain auth failures (expired/invalid token, suspended, etc.) — expected.
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
