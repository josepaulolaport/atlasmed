import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { searchSyncUseCases } from "../../composition";
import { parseSearchSyncRequest } from "../../application/use-cases/search-sync.use-case";

export const searchSyncRoutes = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "SEARCH_SYNC"))
  .post(
    "/search-sync",
    async ({ body, set }) => {
      set.status = 202;
      return searchSyncUseCases.start().execute(parseSearchSyncRequest(body));
    },
    {
      detail: {
        summary: "Start a full search index rebuild",
        tags: ["Search Sync"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({ entity: t.Union([t.Literal("facilities"), t.Literal("professionals")]) }),
    }
  )
  .get(
    "/search-sync/:workflowId",
    ({ params }) => searchSyncUseCases.status().execute(params.workflowId),
    {
      detail: {
        summary: "Get a search index rebuild status",
        tags: ["Search Sync"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ workflowId: t.String({ minLength: 1 }) }),
    }
  );
