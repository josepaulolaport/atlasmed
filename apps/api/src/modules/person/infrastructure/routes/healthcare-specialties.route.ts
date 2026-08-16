import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";
import { healthcareSpecialtyCatalog } from "../../../../shared/catalog/support-catalogs";

type Executable = { execute(input?: any): Promise<any> };

export interface HealthcareSpecialtiesHttpUseCases {
  listHealthcareSpecialtyCatalog(): Executable;
}

/**
 * The specialty catalogue, for pickers rather than filters.
 *
 * Its own path rather than a variant of
 * `/healthcare-professionals/specialties`: that one answers "which specialties
 * do our doctors have", which is a different list — narrower, name-only, and
 * wrong to choose from when the doctor does not exist yet.
 */
export function createHealthcareSpecialtiesRoutes(
  useCases: HealthcareSpecialtiesHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/healthcare-specialties",
      async ({ query }) => {
        // Active only by default — this is a picker. `Administração ›
        // Catálogos` opts into the retired ones so an admin can bring one back
        // (spec 0016 §4).
        if (query.includeInactive === "true") {
          return { data: await healthcareSpecialtyCatalog.listAll() };
        }
        return useCases.listHealthcareSpecialtyCatalog().execute();
      },
      {
        detail: {
          summary: "List the healthcare specialty catalog (id, name)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({ includeInactive: t.Optional(t.String()) }),
      }
    );
}

export const healthcareSpecialtiesRoute = createHealthcareSpecialtiesRoutes();
