import { Elysia } from "elysia";
import { PrismaSessionRepository } from "../repositories/prisma/prisma-session.repository";
import { authMiddleware } from "../middleware/auth.middleware";
import type { Session } from "@atlasmed/database";

const sessionRepository = new PrismaSessionRepository();

export const sessionsRoute = new Elysia({ prefix: "/access" })
  .use(authMiddleware)
  .get("/sessions", async ({ auth }: any) => {
    const sessions = await sessionRepository.findByUserId(auth.user.id);

    return {
      sessions: sessions.map((session: Session) => ({
        id: session.id,
        deviceType: session.deviceType,
        browserName: session.browserName,
        browserVersion: session.browserVersion,
        osName: session.osName,
        ipAddress: session.ipAddress,
        lastSeenAt: session.lastSeenAt,
        createdAt: session.createdAt,
        isCurrent: session.id === auth.sessionId,
      })),
    };
  })
  .delete("/sessions/:id", async ({ auth, params }: any) => {
    const session = await sessionRepository.findById(params.id);

    if (!session) {
      throw new Error("Session not found");
    }

    // Users can only revoke their own sessions
    if (session.userId !== auth.user.id) {
      throw new Error("You can only revoke your own sessions");
    }

    // Prevent revoking current session
    if (session.id === auth.sessionId) {
      throw new Error("Cannot revoke current session. Use logout instead.");
    }

    await sessionRepository.revoke(params.id);

    return {
      message: "Session revoked successfully",
    };
  });
