import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { readVerticalIdHeader } from "../../../access/application/services/vertical-access.service";
import { dashboardUseCases } from "../../composition";

export const dashboardRoute = new Elysia({ prefix: "/dashboard" })
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/summary",
    async ({ query, request, getScope, getUser }) => {
      const scope = await getScope();
      const actor = await getUser();
      const headerVerticalId = readVerticalIdHeader(request.headers);
      return dashboardUseCases.getSummary().execute({
        userId: actor.id,
        role: actor.role.name,
        scope,
        verticalId: headerVerticalId ?? query.verticalId ?? null,
      });
    },
    {
      detail: {
        summary:
          "Dashboard summary (purchase-status buckets + territory card data)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    },
  );
