import { Elysia, t } from "elysia";
import { loginSchema, REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";

import { redis } from "../../../../infrastructure/cache/redis.client";

import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";

import { PrismaSessionRepository } from "../repositories/prisma/prisma-session.repository";

import { SessionCacheService } from "../cache/session-cache.service";

import { LoginUseCase } from "../../application/use-cases/login.use-case";

const userRepository = new PrismaUserRepository();

const sessionRepository = new PrismaSessionRepository();

const sessionCache = new SessionCacheService();

const loginUseCase = new LoginUseCase({
  userRepository,

  sessionRepository,

  sessionCache,

  redis,
});

export const loginRoute = new Elysia({
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
}).post(
  "/password",

  async ({ body, request, cookie }) => {
    const parsed = loginSchema.parse(body);

    const result = await loginUseCase.execute({
      identifier: parsed.identifier,

      password: parsed.password,

      ipAddress: request.headers.get("x-forwarded-for") || undefined,

      userAgent: request.headers.get("user-agent") || undefined,
    });

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
