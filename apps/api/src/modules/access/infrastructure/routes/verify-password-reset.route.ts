import { Elysia, t } from "elysia";
import { accessUseCases } from "../../composition";
import { passwordResetConfirmRateLimit } from "../middleware/rate-limit.middleware";

export const verifyPasswordResetRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(passwordResetConfirmRateLimit)
  .post(
    "/password-reset/verify",
    async ({ body }) => {
      return accessUseCases.verifyPasswordResetToken().execute({
        token: body.token,
      });
    },
    {
      detail: {
        summary: "Verify password reset token",
        description:
          "Checks that a password reset code is valid and unused without consuming it.",
        tags: ["Authentication"],
      },
      body: t.Object({
        token: t.String({
          description: "Password reset code from email or WhatsApp",
          minLength: 6,
          maxLength: 6,
        }),
      }),
      response: {
        200: t.Object({
          valid: t.Boolean(),
        }),
      },
    }
  );
