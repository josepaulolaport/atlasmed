import { Elysia } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";

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
      async () => useCases.listHealthcareSpecialtyCatalog().execute(),
      {
        detail: {
          summary: "List the active healthcare specialty catalog (id, name)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );
}

export const healthcareSpecialtiesRoute = createHealthcareSpecialtiesRoutes();
