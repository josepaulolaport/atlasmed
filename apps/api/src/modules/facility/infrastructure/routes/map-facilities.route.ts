import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";

const verticalIdQuery = t.Optional(t.Number({ minimum: 1 }));

export const mapFacilitiesQuerySchema = t.Union([
  t.Object(
    { verticalId: verticalIdQuery },
    { additionalProperties: false },
  ),
  t.Object(
    {
      verticalId: verticalIdQuery,
      south: t.Number({ minimum: -90, maximum: 90 }),
      west: t.Number({ minimum: -180, maximum: 180 }),
      north: t.Number({ minimum: -90, maximum: 90 }),
      east: t.Number({ minimum: -180, maximum: 180 }),
    },
    { additionalProperties: false },
  ),
]);

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
        bounds:
          "south" in query
            ? {
                south: query.south,
                west: query.west,
                north: query.north,
                east: query.east,
              }
            : undefined,
      });
    },
    {
      detail: {
        summary:
          "List thin geocoded facility points for live-map client clustering",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: mapFacilitiesQuerySchema,
    }
  );
