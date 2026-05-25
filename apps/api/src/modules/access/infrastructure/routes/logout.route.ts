import { Elysia, t } from "elysia";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { PrismaSessionRepository } from "../repositories/prisma/prisma-session.repository";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { authMiddleware } from "../middleware/auth.middleware";

const sessionRepository = new PrismaSessionRepository();

const logoutUseCase = new LogoutUseCase({
  sessionRepository,
});

export const logoutRoute = new Elysia({ 
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
})
  .use(authMiddleware)
  .post("/logout", async ({ auth, cookie }: any) => {
    await logoutUseCase.execute({
      sessionId: auth.sessionId,
    });

    // Clear refresh token cookie
    cookie[REFRESH_TOKEN_COOKIE_NAME]?.remove();

    return {
      message: "Logged out successfully",
    };
  }, {
    detail: {
      summary: "Logout",
      description: "Revoke the current session, invalidate the access token, and clear the refresh token cookie",
      tags: ["Authentication"],
      security: [{ bearerAuth: [] }],
    },
    response: {
      200: t.Object({
        message: t.String(),
      }),
      401: t.Object({
        error: t.String({ description: "Unauthorized - invalid or expired token" }),
      }),
    },
  });
