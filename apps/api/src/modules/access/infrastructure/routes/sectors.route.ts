import { Elysia, t } from "elysia";
import { accessRepositories, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const sectorsRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/sectors",
    async () => {
      const sectors = await accessRepositories.scope.listActiveSectors();
      return { sectors };
    },
    {
      detail: {
        summary: "List healthcare sectors",
        description: "Returns all active healthcare sectors. Used to populate sector selectors in invite and profile forms.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      response: {
        200: t.Object({
          sectors: t.Array(
            t.Object({
              id: t.String(),
              slug: t.String(),
              name: t.String(),
            })
          ),
        }),
      },
    }
  );
