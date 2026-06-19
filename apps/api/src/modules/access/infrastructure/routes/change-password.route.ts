import { Elysia, t } from "elysia";
import { changePasswordSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { passwordChangeRateLimit } from "../middleware/rate-limit.middleware";
import { getClientIp } from "../../../../shared/utils/client-ip";

export const changePasswordRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(auth)
  .use(passwordChangeRateLimit)
  .patch(
    "/password",
    async ({ getUserId, getSessionId, body, request }: any) => {
      const userId = await getUserId();
      const sessionId = await getSessionId();
      const parsed = changePasswordSchema.parse(body);

      return await accessUseCases.changePassword().execute({
        userId,
        currentPassword: parsed.currentPassword,
        newPassword: parsed.newPassword,
        revokeOtherSessions: parsed.revokeOtherSessions,
        sessionId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
      });
    },
    {
      detail: {
        summary: "Change password",
        description:
          "Change the authenticated user's password. Optionally revoke other sessions.",
        tags: ["Authentication"],
      },
      body: t.Object({
        currentPassword: t.String({ description: "Current password" }),
        newPassword: t.String({
          description: "New password (min 8 characters)",
          minLength: 8,
        }),
        revokeOtherSessions: t.Optional(
          t.Boolean({
            description: "Revoke all sessions except the current one",
          })
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
      },
    }
  );
