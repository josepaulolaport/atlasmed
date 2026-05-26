import { Elysia, t } from "elysia";
import { accessUseCases, auth } from "../../composition";
import { sessionRevokeRateLimit } from "../middleware/rate-limit.middleware";

export const sessionsRoute = new Elysia()
  .use(auth)
  .use(sessionRevokeRateLimit)
  .get("/sessions", async ({ getUserId, getSessionId }: any) => {
    const userId = await getUserId();
    const currentSessionId = await getSessionId();
    
    const result = await accessUseCases.getUserSessions().execute({
      userId,
      currentSessionId,
    });

    return result;
  })
  .delete("/sessions/:id", async ({ getUserId, getSessionId, params, status }: any) => {
    const userId = await getUserId();
    const currentSessionId = await getSessionId();
    
    const result = await accessUseCases.revokeSession().execute({
      sessionId: params.id,
      userId,
      currentSessionId,
    });

    if (!result.success) {
      if (result.error === "not-found") {
        return status(404, { 
          code: "NOT_FOUND",
          message: "Session not found" 
        });
      }
      
      if (result.error === "unauthorized") {
        return status(403, { 
          code: "FORBIDDEN",
          message: "You can only revoke your own sessions" 
        });
      }
      
      if (result.error === "cannot-revoke-current") {
        return status(400, { 
          code: "INVALID_OPERATION",
          message: "Cannot revoke current session. Use logout instead." 
        });
      }
    }

    return {
      message: "Session revoked successfully",
    };
  })
  .post("/sessions/revoke-others", async ({ getUserId, getSessionId }: any) => {
    const userId = await getUserId();
    const currentSessionId = await getSessionId();

    const result = await accessUseCases.revokeOtherSessions().execute({
      userId,
      currentSessionId,
    });

    return {
      message: "Other sessions revoked successfully",
      revokedCount: result.revokedCount,
    };
  });
