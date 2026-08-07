import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";

export const mapFacilitiesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/map/facilities/points",
    async ({ query, getScope, getUser }) => {
      const scope = await getScope();
      const actor = await getUser();
      return facilityUseCases.listMapFacilityPoints().execute({
        scope,
        role: actor.role.name,
        verticalId: query.verticalId,
      });
    },
    {
      detail: {
        summary:
          "List thin geocoded facility points for live-map client clustering",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );
