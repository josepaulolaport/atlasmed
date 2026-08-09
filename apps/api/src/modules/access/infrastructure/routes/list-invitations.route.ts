import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const listInvitationsRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/invitations",
    async ({ query, getUserId, getUser, getScope }) => {
      const actor = await getUser();
      const result = await accessUseCases.getInvitations().execute({
        status: query.status,
        page: query.page,
        limit: query.limit,
        actorId: await getUserId(),
        actorRole: actor.role.name as Role,
        scope: await getScope(),
      });

      return result;
    },
    {
      detail: {
        summary: "List invitations",
        description: "List all user invitations. Requires read permission on users.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("PENDING"),
            t.Literal("ACCEPTED"),
            t.Literal("EXPIRED"),
            t.Literal("REVOKED"),
          ])
        ),
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      }),
    }
  );
