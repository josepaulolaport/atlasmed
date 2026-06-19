import { Elysia, t } from "elysia";
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
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        scope,
      });

      return result;
    },
    {
      detail: {
        summary: "List users",
        description: "List all users with pagination and optional filters. Requires read permission on users.",
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
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  );
