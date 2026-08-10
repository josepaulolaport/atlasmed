import { Elysia, t } from "elysia";
import {
  updateProfileSchema,
  updateUserPreferencesSchema,
} from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { serializeUser } from "./user.serializer";
import { profileRateLimit } from "../middleware/rate-limit.middleware";
import { ValidationError } from "../../../../shared/errors";

const capabilityResponseSchema = t.Array(
  t.Object({
    action: t.String(),
    subject: t.String(),
    inverted: t.Optional(t.Literal(true)),
  }),
);

function toValidationError(error: unknown): ValidationError {
  if (error && typeof error === "object" && "issues" in error) {
    const issues =
      (
        error as {
          issues?: Array<{ path: Array<string | number>; message: string }>;
        }
      ).issues ?? [];
    return new ValidationError(
      issues.map((issue) => ({
        field: issue.path.length ? `body.${issue.path.join(".")}` : "body",
        message: issue.message,
      })),
    );
  }

  return new ValidationError([
    { field: "body", message: "Invalid request body" },
  ]);
}

export const userRoute = new Elysia({
  detail: {
    tags: ["User"],
    security: [{ bearerAuth: [] }],
  },
})
  .use(auth)
  .use(profileRateLimit)
  .get(
    "/user",
    async ({ getUser }) => {
      const user = await getUser();
      return serializeUser(user);
    },
    {
      detail: {
        summary: "Get authenticated user profile",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/user/capabilities",
    async ({ getUserId }: any) => {
      return accessUseCases.getCapabilities().execute({
        userId: await getUserId(),
      });
    },
    {
      response: {
        200: t.Object({
          version: t.Literal(2),
          capabilities: capabilityResponseSchema,
        }),
      },
      detail: {
        summary: "Get authenticated user capabilities",
        description:
          "Returns the authenticated user's ordered type-level CASL ability rules.",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .patch(
    "/user",
    async ({ getUserId, body }: any) => {
      const parsed = updateProfileSchema.safeParse(body);
      if (!parsed.success) {
        throw toValidationError(parsed.error);
      }

      const userId = await getUserId();
      const updatedUser = await accessUseCases.updateProfile().execute({
        userId,
        ...parsed.data,
      });

      return serializeUser(updatedUser);
    },
    {
      body: t.Object({
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String()),
      }),
      detail: {
        summary: "Update authenticated user profile",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/user/assignments",
    async ({ getUserId, getUser }: any) => {
      const userId = await getUserId();
      const actor = await getUser();

      return accessUseCases.getUserAssignments().execute({
        targetUserId: userId,
        actorRole: actor.role.name,
        self: true,
      });
    },
    {
      detail: {
        summary: "Get authenticated user assignments",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/user/preferences",
    async ({ getUserId }: any) => {
      const userId = await getUserId();
      return accessUseCases.getUserPreferences().execute({ userId });
    },
    {
      detail: {
        summary: "Get authenticated user preferences",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .patch(
    "/user/preferences",
    async ({ getUserId, body }: any) => {
      const parsed = updateUserPreferencesSchema.safeParse(body);
      if (!parsed.success) {
        throw toValidationError(parsed.error);
      }

      const userId = await getUserId();
      return accessUseCases.updateUserPreferences().execute({
        userId,
        ...parsed.data,
      });
    },
    {
      body: t.Object({
        theme: t.Optional(
          t.Union([t.Literal("system"), t.Literal("light"), t.Literal("dark")]),
        ),
        pushNotificationsEnabled: t.Optional(t.Boolean()),
        emailNotificationsEnabled: t.Optional(t.Boolean()),
        smsNotificationsEnabled: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update authenticated user preferences",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
