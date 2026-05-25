import { Elysia } from "elysia";
import { UnauthorizedError } from "@atlasmed/access";
import { TokenService } from "../../application/services/token.service";
import { PrismaSessionRepository } from "../repositories/prisma/prisma-session.repository";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";
import { redis } from "../../../../infrastructure/cache/redis.client";
import { sessionCacheService } from "../cache/session-cache.service";
import { authCacheService } from "../cache/auth-cache.service";

const tokenService = new TokenService();
const sessionRepository = new PrismaSessionRepository();
const userRepository = new PrismaUserRepository();

const LAST_SEEN_THRESHOLD = 5 * 60 * 1000;

export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ request }) => {
    const authHeader = request.headers.get("authorization");
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("Missing or invalid authorization header", { ipAddress });
      throw new UnauthorizedError();
    }

    const token = authHeader.substring(7);

    try {
      const payload = await tokenService.verifyAccessToken(token);

      let session = await sessionCacheService.getById(payload.sid);

      if (!session) {
        const dbSession = await sessionRepository.findById(payload.sid);

        if (!dbSession) {
          console.warn("Session not found", { 
            sessionId: payload.sid, 
            userId: payload.sub,
            ipAddress
          });
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
      }

      if (session.revokedAt) {
        console.warn("Revoked session attempted", { 
          sessionId: payload.sid, 
          userId: payload.sub,
          revokedAt: session.revokedAt,
          ipAddress
        });
        throw new UnauthorizedError();
      }

      if (new Date(session.expiresAt) < new Date()) {
        console.warn("Expired session attempted", { 
          sessionId: payload.sid, 
          userId: payload.sub,
          expiresAt: session.expiresAt,
          ipAddress
        });
        throw new UnauthorizedError();
      }

      let authContext = await authCacheService.get(payload.sub);

      if (!authContext) {
        const user = await userRepository.findById(payload.sub);

        if (!user) {
          console.warn("User not found for valid session", { 
            userId: payload.sub, 
            sessionId: payload.sid,
            ipAddress
          });
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
      }

      if (payload.tokenVersion !== authContext.tokenVersion) {
        console.warn("Token version mismatch - token invalidated", { 
          userId: payload.sub, 
          sessionId: payload.sid,
          jwtVersion: payload.tokenVersion,
          currentVersion: authContext.tokenVersion,
          ipAddress
        });
        throw new UnauthorizedError();
      }

      if (authContext.status !== "ACTIVE") {
        console.warn("Inactive user attempted access", { 
          userId: payload.sub, 
          status: authContext.status,
          ipAddress
        });
        throw new UnauthorizedError();
      }

      const lastSeenKey = `session:${payload.sid}:lastSeen`;
      const lastSeenCache = await redis.get(lastSeenKey);
      
      if (!lastSeenCache) {
        sessionRepository.updateLastSeen(payload.sid).catch((error) => {
          console.error("Failed to update lastSeen", { sessionId: payload.sid, error: error.message });
        });
        sessionCacheService.updateLastSeen(payload.sid).catch((error) => {
          console.error("Failed to update lastSeen in cache", { sessionId: payload.sid, error: error.message });
        });
        redis.setex(lastSeenKey, 300, Date.now().toString()).catch((error) => {
          console.error("Failed to cache lastSeen", { sessionId: payload.sid, error: error.message });
        });
      } else {
        const lastSeenTime = parseInt(lastSeenCache, 10);
        const timeSinceLastUpdate = Date.now() - lastSeenTime;
        
        if (timeSinceLastUpdate > LAST_SEEN_THRESHOLD) {
          sessionRepository.updateLastSeen(payload.sid).catch((error) => {
            console.error("Failed to update lastSeen", { sessionId: payload.sid, error: error.message });
          });
          sessionCacheService.updateLastSeen(payload.sid).catch((error) => {
            console.error("Failed to update lastSeen in cache", { sessionId: payload.sid, error: error.message });
          });
          redis.setex(lastSeenKey, 300, Date.now().toString()).catch((error) => {
            console.error("Failed to cache lastSeen", { sessionId: payload.sid, error: error.message });
          });
        }
      }

      const user = session.user ? {
        id: session.user.id,
        email: session.user.email,
        username: session.user.username,
        status: authContext.status,
        role: {
          id: authContext.roleId,
          name: authContext.roleName,
        },
      } : await userRepository.findById(payload.sub);

      return {
        auth: {
          user,
          sessionId: payload.sid,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      
      console.error("Auth middleware unexpected error", { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ipAddress 
      });
      
      throw new UnauthorizedError();
    }
  });
