import { Elysia, t } from "elysia";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { getRefreshCookieRemoveOptions } from "./refresh-cookie";
import { getClientIp } from "../../../../shared/utils/client-ip";

export const logoutRoute = new Elysia({ 
  detail: {
    tags: ["Authentication"],
  },
})
  .use(auth)
  .post("/logout", async ({ getUserId, getSessionId, cookie, request }: any) => {
    const userId = await getUserId();
    const sessionId = await getSessionId();
    
    await accessUseCases.logout().execute({
      sessionId,
      userId,
      ipAddress: getClientIp(request),
    });

    cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(getRefreshCookieRemoveOptions());

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
