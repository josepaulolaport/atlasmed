import { Elysia, t } from "elysia";
import { acceptInviteSchema } from "@atlasmed/access";
import { accessUseCases } from "../../composition";
import { registerRateLimit } from "../middleware/rate-limit.middleware";

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
        role: result.role,
        expiresAt: result.expiresAt,
      };
    },
    {
      detail: {
        summary: "Validate invite token",
        description:
          "Check that an invite token exists, is pending, and has not expired before registration.",
        tags: ["Authentication"],
      },
      params: t.Object({
        token: t.String({ description: "Invite token from email or SMS" }),
      }),
      response: {
        200: t.Object({
          email: t.Optional(t.String()),
          phoneNumber: t.Optional(t.String()),
          role: t.Object({
            id: t.String(),
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
      firstName: parsed.firstName || undefined,
      lastName: parsed.lastName || undefined,
    });

    const responseUser: {
      id: string;
      email: string;
      username: string;
      firstName?: string;
      lastName?: string;
      status: string;
    } = {
      id: user.id,
      email: user.email,
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
      firstName: t.Optional(t.String({ description: "User first name" })),
      lastName: t.Optional(t.String({ description: "User last name" })),
    }),
    response: {
      200: t.Object({
        user: t.Object({
          id: t.String(),
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
    if (error instanceof Error && error.message.includes("already taken")) {
      set.status = 409;
      return {
        error: error.message,
        code: "CONFLICT",
        suggestion: "Please choose a different value",
      };
    }

    if (error instanceof Error && error.message.includes("does not match")) {
      set.status = 400;
      return {
        error: error.message,
        code: "IDENTIFIER_MISMATCH",
        hint: "The email or phone number must match where the invitation was sent",
      };
    }

    throw error;
  });
