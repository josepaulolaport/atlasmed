import { Elysia, t } from "elysia";
import { AppError } from "../../../../shared/errors";
import { acceptInviteSchema } from "@atlasmed/access";
import { accessUseCases } from "../../composition";
import { registerRateLimit } from "../middleware/rate-limit.middleware";

export function mapAcceptInviteRouteError(
  error: unknown,
): { status: number; body: Record<string, unknown> } | null {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: { error: error.toClientJSON() },
    };
  }

  if (error instanceof Error && error.message.includes("already taken")) {
    return {
      status: 409,
      body: {
        error: error.message,
        code: "CONFLICT",
        suggestion: "Please choose a different value",
      },
    };
  }

  if (error instanceof Error && error.message.includes("does not match")) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: "IDENTIFIER_MISMATCH",
        hint: "The email or phone number must match where the invitation was sent",
      },
    };
  }

  return null;
}

export const acceptInviteRoute = new Elysia({ 
  detail: {
    tags: ["Authentication"],
  },
})
  .use(registerRateLimit)
  .get(
    "/invite/:token",
    async ({ params }) => {
      const result = await accessUseCases.validateInvite().execute({
        token: params.token,
      });

      return {
        email: result.email,
        phoneNumber: result.phoneNumber,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        expiresAt: result.expiresAt,
      };
    },
    {
      detail: {
        summary: "Validate invite token",
        description:
          "Check that an invite token exists, is pending, and has not expired before registration. Returns invitee identity fields to confirm or complete on the register form (manager/territory stay server-side).",
        tags: ["Authentication"],
      },
      params: t.Object({
        token: t.String({ description: "Invite token from email or SMS" }),
      }),
      response: {
        200: t.Object({
          email: t.Optional(t.String()),
          phoneNumber: t.Optional(t.String()),
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          role: t.Object({
            id: t.Number(),
            name: t.String(),
          }),
          expiresAt: t.String(),
        }),
        400: t.Object({
          error: t.String(),
        }),
      },
    }
  )
  .post("/register", async ({ body }) => {
    const parsed = acceptInviteSchema.parse(body);

    const user = await accessUseCases.acceptInvite().execute({
      token: parsed.token,
      email: parsed.email,
      phoneNumber: parsed.phoneNumber || undefined,
      username: parsed.username,
      password: parsed.password,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      birthDate: parsed.birthDate,
    });

    const responseUser: {
      id: number;
      email: string;
      username: string;
      firstName?: string;
      lastName?: string;
      status: string;
    } = {
      id: user.id,
      email: user.email!,
      username: user.username,
      status: user.status as string,
    };

    if (user.firstName) responseUser.firstName = user.firstName;
    if (user.lastName) responseUser.lastName = user.lastName;

    return {
      user: responseUser,
      message: "Registration successful. You can now login.",
    };
  }, {
    detail: {
      summary: "Complete registration with invite token",
      description: "Register a new account using an invite token. Email must match where the invite was sent. If invited via phone, provide both phone and email.",
      tags: ["Authentication"],
    },
    body: t.Object({
      token: t.String({ description: "Invite token received via email or WhatsApp" }),
      email: t.String({ format: "email", description: "User email address (required)" }),
      phoneNumber: t.Optional(t.String({ description: "User phone number (required if invited via phone)" })),
      username: t.String({ description: "Chosen username", minLength: 3 }),
      password: t.String({ description: "User password", minLength: 8 }),
      firstName: t.String({ minLength: 1, description: "Confirmed first name" }),
      lastName: t.String({ minLength: 1, description: "Confirmed last name" }),
      birthDate: t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Confirmed birth date (YYYY-MM-DD)",
      }),
    }),
    response: {
      200: t.Object({
        user: t.Object({
          id: t.Number(),
          email: t.String(),
          username: t.String(),
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          status: t.String(),
        }),
        message: t.String(),
      }),
      400: t.Object({
        error: t.String({ description: "Validation error or invalid invite" }),
        code: t.Optional(t.String()),
        hint: t.Optional(t.String()),
      }),
      409: t.Object({
        error: t.String({ description: "Conflict error (username/email/phone already taken)" }),
        code: t.Optional(t.String()),
        suggestion: t.Optional(t.String()),
      }),
    },
  })
  .onError(({ error, set }) => {
    const mapped = mapAcceptInviteRouteError(error);
    if (!mapped) throw error;

    set.status = mapped.status;
    return mapped.body;
  });
