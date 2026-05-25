import { Elysia, t } from "elysia";
import { accessUseCases } from "../../composition";

export const resetPasswordRoute = new Elysia({
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
}).post(
  "/password-reset/confirm",

  async ({ body, request }) => {
    const result = await accessUseCases.resetPassword().execute({
      token: body.token,
      newPassword: body.newPassword,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
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
