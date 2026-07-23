import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const listUsersRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/users",
    async ({ query, getScope }) => {
      const scope = await getScope();
      const result = await accessUseCases.listUsers().execute({
        status: query.status,
        role: query.role,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        sectorId: query.sectorId,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        scope,
      });

      return result;
    },
    {
      detail: {
        summary: "List users",
        description:
          "List all users with pagination, optional filters, and sort by name/role/status. Requires read permission on users.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("ACTIVE"),
            t.Literal("INACTIVE"),
            t.Literal("SUSPENDED"),
            t.Literal("PENDING"),
          ])
        ),
        role: t.Optional(t.String({ description: "Filter by role name (e.g. MANAGER, REP)" })),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sectorId: t.Optional(t.String({ description: "Filter to users assigned to this healthcare sector" })),
        sortBy: t.Optional(
          t.Union([
            t.Literal("name"),
            t.Literal("role"),
            t.Literal("status"),
            t.Literal("createdAt"),
          ]),
        ),
        sortDir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
    }
  )
  .get(
    "/users/:id",
    async ({ params, getUser }) => {
      const actor = await getUser();
      return accessUseCases.getUserById().execute({
        targetUserId: params.id,
        actorRole: actor.role.name as Role,
      });
    },
    {
      detail: {
        summary: "Get a single user by id",
        description: "Admin-only single-user lookup, e.g. to resolve a territory's assignee.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
    }
  );
