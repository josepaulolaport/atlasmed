import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { searchSyncUseCases } from "../../composition";
import { parseSearchSyncRequest } from "../../application/use-cases/search-sync.use-case";

export const searchSyncRoutes = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "SEARCH_SYNC"))
  .post(
    "/sync",
    async ({ body, set }) => {
      set.status = 202;
      return searchSyncUseCases.start().execute(parseSearchSyncRequest(body));
    },
    {
      detail: {
        summary: "Start an operations sync",
        tags: ["Search Sync"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        entity: t.Union([
          t.Literal("facilities"),
          t.Literal("persons"),
          t.Literal("orders"),
          t.Literal("emultec-orders"),
          t.Literal("cnes"),
        ]),
        /*
         * CNES only. Omit both to load whatever competência DATASUS has
         * published that we have not already completed — which is what the
         * weekly schedule does. Supply `reference` to reload a specific one, and
         * `force` when the ledger already marks it COMPLETED.
         */
        reference: t.Optional(
          t.Object({
            year: t.Integer({ minimum: 2000, maximum: 2100 }),
            month: t.Integer({ minimum: 1, maximum: 12 }),
          })
        ),
        force: t.Optional(t.Boolean()),
      }),
    }
  )
  .get(
    "/sync/:workflowId",
    ({ params }) => searchSyncUseCases.status().execute(params.workflowId),
    {
      detail: {
        summary: "Get an operations sync status",
        tags: ["Search Sync"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ workflowId: t.String({ minLength: 1 }) }),
    }
  );
