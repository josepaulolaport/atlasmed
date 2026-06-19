import { Elysia, t } from "elysia";
import { accessUseCases } from "../../composition";
import { passwordResetConfirmRateLimit } from "../middleware/rate-limit.middleware";
import { getClientIp } from "../../../../shared/utils/client-ip";

export const resetPasswordRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(passwordResetConfirmRateLimit)
  .post(
  "/password-reset/confirm",

  async ({ body, request }) => {
    const result = await accessUseCases.resetPassword().execute({
      token: body.token,
      newPassword: body.newPassword,
      ipAddress: getClientIp(request),
    });

    return result;
  },
  {
    detail: {
      summary: "Reset password",
      description: "Reset password using the token received via email or WhatsApp. All existing sessions will be invalidated.",
      tags: ["Authentication"],
    },
    body: t.Object({
      token: t.String({
        description: "Password reset token",
      }),
      newPassword: t.String({
        description: "New password (min 8 characters)",
        minLength: 8,
      }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
      }),
      400: t.Object({
        error: t.String({ description: "Validation error" }),
      }),
      401: t.Object({
        error: t.String({ description: "Invalid or expired token" }),
      }),
    },
  }
);
