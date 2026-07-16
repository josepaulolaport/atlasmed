import { Elysia, t } from "elysia";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { UnauthorizedError } from "../../../../shared/errors";
import { environment } from "../../../../app/config/environment";
import { accessUseCases } from "../../composition";
import { refreshRateLimit } from "../middleware/rate-limit.middleware";
import { getRefreshCookieOptions } from "./refresh-cookie";
import { serializeAuthUser } from "./user.serializer";
import { getClientIp } from "../../../../shared/utils/client-ip";

export const refreshSessionRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(refreshRateLimit)
  .post(
    "/refresh",
    async ({ body, cookie, request }) => {
      const bodyData = body as { refreshToken?: string } | undefined;
      const cookieToken = cookie[REFRESH_TOKEN_COOKIE_NAME]?.value;
      const bodyToken = bodyData?.refreshToken;

      let refreshToken: string | undefined;

      if (environment.NODE_ENV === "production") {
        refreshToken = cookieToken as string | undefined;
        if (bodyToken) {
          throw new UnauthorizedError(
            "Refresh token must be sent via httpOnly cookie in production",
          );
        }
      } else {
        refreshToken =
          (cookieToken as string | undefined) ||
          (bodyToken as string | undefined);
      }

      if (!refreshToken) {
        throw new UnauthorizedError("Refresh token is required");
      }

      const result = await accessUseCases.refreshSession().execute({
        refreshToken,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
        acceptLanguage: request.headers.get("accept-language") || undefined,
      });

      cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(
        getRefreshCookieOptions(result.refreshToken),
      );

      return {
        session: {
          token: result.accessToken,
        },
        user: serializeAuthUser(result.user),
      };
    },
    {
      detail: {
        summary: "Refresh session",
        description:
          "Refresh the access token using the httpOnly refresh cookie (production) or cookie/body (development). SameSite=strict.",
        tags: ["Authentication"],
      },
      body: t.Optional(
        t.Object({
          refreshToken: t.Optional(
            t.String({ description: "Refresh token (development only)" }),
          ),
        }),
      ),
      response: {
        200: t.Object({
          session: t.Object({
            token: t.String({ description: "New JWT access token" }),
          }),
          user: t.Object({
            id: t.String(),
            email: t.String(),
            username: t.String(),
            firstName: t.Optional(t.String()),
            lastName: t.Optional(t.String()),
            status: t.String(),
          }),
        }),
        400: t.Object({
          error: t.String({ description: "Refresh token is required" }),
        }),
        401: t.Object({
          error: t.String({ description: "Invalid or expired refresh token" }),
        }),
      },
    },
  );
