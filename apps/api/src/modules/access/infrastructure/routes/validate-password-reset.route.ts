import { Elysia, t } from "elysia";
import { accessUseCases } from "../../composition";
import { passwordResetValidateRateLimit } from "../middleware/rate-limit.middleware";

export const validatePasswordResetRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(passwordResetValidateRateLimit)
  .post(
    "/password-reset/validate",
    async ({ body }) => {
      return accessUseCases.validatePasswordReset().execute({
        token: body.token,
      });
    },
    {
      detail: {
        summary: "Validate password reset token",
        description:
          "Check whether a password reset token is valid before the user sets a new password.",
        tags: ["Authentication"],
      },
      body: t.Object({
        token: t.String({
          description: "Password reset token from email or WhatsApp",
          minLength: 8,
        }),
      }),
      response: {
        200: t.Object({
          valid: t.Literal(true),
        }),
        401: t.Object({
          error: t.String({ description: "Invalid token" }),
        }),
        410: t.Object({
          error: t.String({ description: "Expired token" }),
        }),
      },
    },
  );
