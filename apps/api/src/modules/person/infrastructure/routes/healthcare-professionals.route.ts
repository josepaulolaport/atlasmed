import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { parseListHealthcareProfessionalsQuery } from "../../application/list-healthcare-professionals-query";
import { personUseCases } from "../../composition";

type Executable = { execute(input?: any): Promise<any> };

export interface HealthcareProfessionalsHttpUseCases {
  listHealthcareProfessionals(): Executable;
  listHealthcareSpecialties(): Executable;
}

/** Static path — must register before any `/healthcare-professionals/:id`. */
const listHealthcareSpecialtiesRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/healthcare-professionals/specialties",
      async () => useCases.listHealthcareSpecialties().execute(),
      {
        detail: {
          summary:
            "Distinct active specialty names used by non-deleted persons",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const listHealthcareProfessionalsRoute = (
  useCases: HealthcareProfessionalsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/healthcare-professionals",
      async ({ query, getScope, getUser }) => {
        const user = await getUser();
        const scope = await getScope();
        const filters = parseListHealthcareProfessionalsQuery(query);
        return useCases.listHealthcareProfessionals().execute({
          page: query.page,
          limit: query.limit,
          search: query.search,
          facilityId: query.facilityId,
          excludeFacilityId: query.excludeFacilityId,
          userId: user.id,
          role: user.role.name,
          ...filters,
          scope,
        });
      },
      {
        detail: {
          summary:
            "List healthcare professionals (Meili when searching; SQL otherwise)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          search: t.Optional(t.String()),
          facilityId: t.Optional(t.Number({ minimum: 1 })),
          excludeFacilityId: t.Optional(t.Number({ minimum: 1 })),
          latitude: t.Optional(t.String()),
          longitude: t.Optional(t.String()),
          radiusKm: t.Optional(t.String()),
          specialty: t.Optional(t.String()),
          sort: t.Optional(t.String()),
          order: t.Optional(t.String()),
        }),
      }
    );

export function createHealthcareProfessionalsRoutes(
  useCases: HealthcareProfessionalsHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(listHealthcareSpecialtiesRoute(useCases, authPlugin))
    .use(listHealthcareProfessionalsRoute(useCases, authPlugin));
}

export const healthcareProfessionalsRoute = createHealthcareProfessionalsRoutes();
