import { Elysia, t } from "elysia";
import {
  Role,
  updateProfileSchema,
  updateUserPreferencesSchema,
} from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { serializeUser } from "./user.serializer";
import { profileRateLimit } from "../middleware/rate-limit.middleware";
import { ValidationError } from "../../../../shared/errors";

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

/**
 * Elysia strips anything not named here **before zod ever sees it**, so a field
 * missing from this list is silently dropped rather than rejected — which is
 * exactly how working hours reached the server, validated cleanly, and were
 * never stored. `user.route.test.ts` asserts this stays in step with the zod
 * schema, because the two drifting apart fails silently by construction.
 */
export const userPreferencesBody = t.Object({
  theme: t.Optional(
    t.Union([t.Literal("system"), t.Literal("light"), t.Literal("dark")]),
  ),
  pushNotificationsEnabled: t.Optional(t.Boolean()),
  emailNotificationsEnabled: t.Optional(t.Boolean()),
  smsNotificationsEnabled: t.Optional(t.Boolean()),
  // Nullable, not merely optional: clearing an hour back to "follow the linha"
  // is a real edit, and a schema that only allowed strings would make the reset
  // unsendable — spec 0016 §15.5.5.
  workdayStart: t.Optional(t.Nullable(t.String())),
  workdayEnd: t.Optional(t.Nullable(t.String())),
  lunchStart: t.Optional(t.Nullable(t.String())),
  lunchMinutes: t.Optional(t.Nullable(t.Number())),
});

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
  .patch(
    "/user",
    async ({ getUserId, body }) => {
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
    async ({ getUserId, getUser }) => {
      const userId = await getUserId();
      const actor = await getUser();

      return accessUseCases.getUserAssignments().execute({
        targetUserId: userId,
        actorRole: actor.role.name as Role,
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
    async ({ getUserId }) => {
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
    async ({ getUserId, body }) => {
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
      body: userPreferencesBody,
      detail: {
        summary: "Update authenticated user preferences",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

