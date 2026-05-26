import { Elysia, t } from "elysia";
import { accessUseCases, auth } from "../../composition";
import { requirePermission } from "../middleware/permission.middleware";

export const rolesRoute = new Elysia({ 
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(requirePermission("manage", "USER"))
  .get("/roles", async () => {
    return await accessUseCases.listRoles().execute();
  }, {
    detail: {
      summary: "List available roles",
      description: "Get all available roles that can be assigned to users. Requires user management permissions.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
    },
    response: {
      200: t.Object({
        roles: t.Array(t.Object({
          id: t.String(),
          name: t.String(),
          description: t.Nullable(t.String()),
        })),
      }),
      401: t.Object({
        error: t.String({ description: "Unauthorized" }),
      }),
      403: t.Object({
        error: t.String({ description: "Forbidden - insufficient permissions" }),
      }),
    },
  });
