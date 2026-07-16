import { Elysia, t } from "elysia";
import { loginSchema, REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { accessUseCases, auth } from "../../../access/composition";
import {
  loginRateLimit,
  refreshRateLimit,
  sessionRevokeRateLimit,
} from "../../../access/infrastructure/middleware/rate-limit.middleware";
import {
  getRefreshCookieOptions,
  getRefreshCookieRemoveOptions,
} from "../../../access/infrastructure/routes/refresh-cookie";
import { serializeAuthUser } from "../../../access/infrastructure/routes/user.serializer";
import { getClientIp } from "../../../../shared/utils/client-ip";

/**
 * Sessions resource — RESTful auth operations.
 *
 * POST   /session/   → Create session  (login)
 * PUT    /session/   → Update session  (refresh)
 * DELETE /session/   → Delete session  (logout current)
 * GET    /session/   → List user sessions
 * DELETE /session/:id → Revoke specific session
 * POST   /session/revoke-others → Revoke all other sessions
 */
export const sessionsRoute = new Elysia({
  name: "sessions-route",
  detail: { tags: ["Session"] },
})
  // ── Public: POST / (login) ─────────────────────────────────
  .use(loginRateLimit)
  .post(
    "/",
    async ({ body, request, cookie, set }) => {
      const parsed = loginSchema.parse(body);

      const result = await accessUseCases.login().execute({
        identifier: parsed.identifier,
        password: parsed.password,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
        acceptLanguage: request.headers.get("accept-language") || undefined,
      });

      if ("requires2FA" in result && result.requires2FA) {
        set.status = 400;
        return {
          error: {
            code: "TWO_FACTOR_REQUIRED",
            message: "Two-factor authentication is not supported at this time.",
          },
        };
      }

      // Set httpOnly cookie for web clients
      cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(
        getRefreshCookieOptions(result.refreshToken),
      );

      return {
        session: {
          token: result.accessToken,
          refreshToken: result.refreshToken,
        },
        user: serializeAuthUser(result.user),
      };
    },
    {
      detail: {
        summary: "Create session (login)",
        description:
          "Authenticate with identifier and password. Returns JWT access token and refresh token in the body. Also sets an httpOnly cookie for web clients.",
      },
      body: t.Object({
        identifier: t.String({
          description: "Email, username, or phone number",
        }),
        password: t.String({
          description: "User password (min 8 characters)",
          minLength: 8,
        }),
      }),
      response: {
        200: t.Object({
          session: t.Object({
            token: t.String({ description: "JWT access token" }),
            refreshToken: t.String({ description: "Refresh token" }),
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
          error: t.Object({
            code: t.String(),
            message: t.String(),
          }),
        }),
        401: t.Object({
          error: t.String({ description: "Invalid credentials" }),
        }),
      },
    },
  )

  // ── Public: PUT / (refresh) ────────────────────────────────
  .use(refreshRateLimit)
  .put(
    "/",
    async ({ body, request, cookie }) => {
      // Accept refresh token from cookie (web) or body (mobile/dev)
      const bodyData = body as { refreshToken?: string } | undefined;
      const cookieToken = cookie[REFRESH_TOKEN_COOKIE_NAME]?.value;
      const bodyToken = bodyData?.refreshToken;

      const refreshToken =
        (cookieToken as string | undefined) ||
        (bodyToken as string | undefined);

      if (!refreshToken) {
        throw new Error("Refresh token is required");
      }

      const result = await accessUseCases.refreshSession().execute({
        refreshToken,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
        acceptLanguage: request.headers.get("accept-language") || undefined,
      });

      // Rotate the httpOnly cookie
      cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(
        getRefreshCookieOptions(result.refreshToken),
      );

      return {
        session: {
          token: result.accessToken,
          refreshToken: result.refreshToken,
        },
        user: serializeAuthUser(result.user),
      };
    },
    {
      detail: {
        summary: "Update session (refresh)",
        description:
          "Refresh the access token using a refresh token from the httpOnly cookie (web) or request body (mobile). Returns a new JWT and rotated refresh token.",
      },
      body: t.Optional(
        t.Object({
          refreshToken: t.Optional(
            t.String({ description: "Refresh token (from body for mobile)" }),
          ),
        }),
      ),
      response: {
        200: t.Object({
          session: t.Object({
            token: t.String({ description: "New JWT access token" }),
            refreshToken: t.String({ description: "New refresh token" }),
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
          error: t.String({ description: "Refresh token is required" }),
        }),
        401: t.Object({
          error: t.String({ description: "Invalid or expired refresh token" }),
        }),
      },
    },
  )

  // ── Auth required routes ──────────────────────────────────
  .use(auth)
  .use(sessionRevokeRateLimit)

  // DELETE / (logout current session)
  .delete(
    "/",
    async ({ getUserId, getSessionId, cookie, request }: any) => {
      const userId = await getUserId();
      const sessionId = await getSessionId();

      await accessUseCases.logout().execute({
        sessionId,
        userId,
        ipAddress: getClientIp(request),
      });

      cookie[REFRESH_TOKEN_COOKIE_NAME]?.set(getRefreshCookieRemoveOptions());

      return {
        message: "Logged out successfully",
      };
    },
    {
      detail: {
        summary: "Delete current session (logout)",
        description:
          "Revoke the current session and clear the refresh token cookie.",
        security: [{ bearerAuth: [] }],
      },
      response: {
        200: t.Object({
          message: t.String(),
        }),
        401: t.Object({
          error: t.String({
            description: "Unauthorized - invalid or expired token",
          }),
        }),
      },
    },
  )

  // GET / (list sessions)
  .get(
    "/",
    async ({ getUserId, getSessionId }: any) => {
      const userId = await getUserId();
      const currentSessionId = await getSessionId();

      const result = await accessUseCases.getUserSessions().execute({
        userId,
        currentSessionId,
      });

      return result;
    },
    {
      detail: {
        summary: "List user sessions",
        description:
          "Returns all active sessions for the authenticated user.",
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // DELETE /:id (revoke specific session)
  .delete(
    "/:id",
    async ({ getUserId, getSessionId, params, status }: any) => {
      const userId = await getUserId();
      const currentSessionId = await getSessionId();

      const result = await accessUseCases.revokeSession().execute({
        sessionId: params.id,
        userId,
        currentSessionId,
      });

      if (!result.success) {
        if (result.error === "not-found") {
          return status(404, {
            error: { code: "NOT_FOUND", message: "Session not found" },
          });
        }

        if (result.error === "unauthorized") {
          return status(403, {
            error: {
              code: "FORBIDDEN",
              message: "You can only revoke your own sessions",
            },
          });
        }

        if (result.error === "cannot-revoke-current") {
          return status(400, {
            error: {
              code: "INVALID_OPERATION",
              message:
                "Cannot revoke current session. Use DELETE /session/ instead.",
            },
          });
        }
      }

      return {
        message: "Session revoked successfully",
      };
    },
    {
      detail: {
        summary: "Revoke a specific session",
        description: "Revoke another active session by its ID.",
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.String({ description: "Session ID" }),
      }),
    },
  )

  // POST /revoke-others
  .post(
    "/revoke-others",
    async ({ getUserId, getSessionId }: any) => {
      const userId = await getUserId();
      const currentSessionId = await getSessionId();

      const result = await accessUseCases.revokeOtherSessions().execute({
        userId,
        currentSessionId,
      });

      return {
        message: "Other sessions revoked successfully",
        revokedCount: result.revokedCount,
      };
    },
    {
      detail: {
        summary: "Revoke all other sessions",
        description:
          "Revoke all sessions except the current one for the authenticated user.",
        security: [{ bearerAuth: [] }],
      },
      response: {
        200: t.Object({
          message: t.String(),
          revokedCount: t.Number(),
        }),
      },
    },
  );
