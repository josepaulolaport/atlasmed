import { Elysia, t } from "elysia";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { accessUseCases } from "../../composition";

export const refreshSessionRoute = new Elysia({ 
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
}).post(
  "/refresh",
  async ({ body, cookie, request }) => {
    // Try to get refresh token from cookie first, then from body
    const bodyData = body as any;
    const refreshToken = cookie[REFRESH_TOKEN_COOKIE_NAME]?.value || bodyData?.refreshToken;

    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    const result = await accessUseCases.refreshSession().execute({
      refreshToken,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Set new refresh token in cookie
    cookie[REFRESH_TOKEN_COOKIE_NAME]?.set({
      value: result.refreshToken,
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });

    return {
      session: {
        token: result.accessToken,
      },
      user: result.user,
    };
  },
  {
    detail: {
      summary: "Refresh session",
      description: "Refresh the access token using the refresh token from cookie or request body. Returns new access token and rotates refresh token.",
      tags: ["Authentication"],
    },
    body: t.Optional(t.Object({
      refreshToken: t.Optional(t.String({ description: "Refresh token (if not using cookie)" })),
    })),
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
  }
);
