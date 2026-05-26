import { Elysia, t } from "elysia";
import { accessUseCases } from "../../composition";
import { passwordResetRateLimit } from "../middleware/rate-limit.middleware";

export const requestPasswordResetRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(passwordResetRateLimit)
  .post(
  "/password-reset/request",
  async ({ body, request }) => {
    await accessUseCases.requestPasswordReset().execute({
      identifier: body.identifier,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return {
      message:
        "If an account exists with this identifier, a password reset code has been sent.",
    };
  },
  {
    detail: {
      summary: "Request password reset",
      description:
        "Request a password reset code. Code will be sent via email or WhatsApp depending on the user's contact information.",
      tags: ["Authentication"],
    },
    body: t.Object({
      identifier: t.String({
        description: "Email or phone number",
      }),
    }),
    response: {
      200: t.Object({
        message: t.String(),
      }),
      400: t.Object({
        error: t.String({ description: "Validation error" }),
      }),
    },
  }
);
