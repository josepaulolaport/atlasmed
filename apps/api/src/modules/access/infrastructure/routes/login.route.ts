import { Elysia, t } from "elysia";
import { loginSchema, REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { accessUseCases } from "../../composition";
import { loginRateLimit } from "../middleware/rate-limit.middleware";
import { getRefreshCookieOptions } from "./refresh-cookie";

/**
 * Login rate limiting uses two layers:
 * 1. loginRateLimit (route): caps total login requests per identifier/IP (credential stuffing)
 * 2. RateLimiterService in login.use-case.ts: failed attempts only, locks after 5 failures, clears on success
 */
export const loginRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(loginRateLimit)
  .post(
  "/login",
  async ({ body, request, cookie }) => {
    try {
      const parsed = loginSchema.parse(body);

      const result = await accessUseCases.login().execute({
        identifier: parsed.identifier,
        password: parsed.password,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
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
        user: result.user,
      };
    } catch (error) {
      console.error("[LoginRoute] Error:", error);
      throw error;
    }
  },
  {
    detail: {
      summary: "Login with password",
      description: "Authenticate user with identifier (email, username, or phone) and password. Returns access token and sets refresh token cookie.",
      tags: ["Authentication"],
    },
    body: t.Object({
      identifier: t.String({ description: "Email, username, or phone number" }),
      password: t.String({ description: "User password (min 8 characters)", minLength: 8 }),
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
      400: t.Object({
        error: t.String({ description: "Validation error" }),
      }),
      401: t.Object({
        error: t.String({ description: "Invalid credentials" }),
      }),
    },
  }
);
