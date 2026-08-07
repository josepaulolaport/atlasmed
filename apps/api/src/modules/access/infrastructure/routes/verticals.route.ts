import { Elysia, t } from "elysia";
import { accessRepositories, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const verticalsRoute = new Elysia({
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("read", "USER"))
  .get(
    "/business-verticals",
    async () => {
      const verticals = await accessRepositories.scope.listActiveVerticals();
      return { verticals };
    },
    {
      detail: {
        summary: "List business verticals",
        description:
          "Returns all active business verticals. Used to populate vertical selectors in invite and profile forms.",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
      response: {
        200: t.Object({
          verticals: t.Array(
            t.Object({
              id: t.Number(),
              code: t.String(),
              name: t.String(),
            })
          ),
        }),
      },
    }
  );
