import { Elysia, t } from "elysia";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { accessUseCases } from "../../composition";
import { twoFactorVerifyRateLimit } from "../middleware/rate-limit.middleware";
import { getRefreshCookieOptions } from "./refresh-cookie";
import { serializeAuthUser } from "./user.serializer";
import { getClientIp } from "../../../../shared/utils/client-ip";

export const verify2FALoginRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(twoFactorVerifyRateLimit)
  .post(
    "/login/2fa",
    async ({ body, request, cookie }) => {
      const result = await accessUseCases.verify2faLogin().execute({
        pendingToken: body.pendingToken,
        code: body.code,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
        acceptLanguage: request.headers.get("accept-language") || undefined,
      });

      cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(
        getRefreshCookieOptions(result.refreshToken)
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
        summary: "Complete login with 2FA",
        description:
          "Verify TOTP code to complete login after password authentication.",
        tags: ["Authentication"],
      },
      body: t.Object({
        pendingToken: t.String({ description: "Pending login token from initial login" }),
        code: t.String({ description: "6-digit TOTP code", minLength: 6, maxLength: 6 }),
      }),
      response: {
        200: t.Object({
          session: t.Object({
            token: t.String({ description: "JWT access token" }),
          }),
          user: t.Object({
            id: t.String(),
            email: t.String(),
            username: t.String(),
            firstName: t.Optional(t.String()),
            lastName: t.Optional(t.String()),
            status: t.String(),
            emailVerified: t.Boolean(),
            phoneVerified: t.Boolean(),
            role: t.Object({
              id: t.String(),
              name: t.String(),
              description: t.Optional(t.String()),
            }),
          }),
        }),
      },
    }
  );
