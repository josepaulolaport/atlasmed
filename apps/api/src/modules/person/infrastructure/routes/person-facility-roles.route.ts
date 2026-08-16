import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";
import { personFacilityRoleCatalog } from "../../../../shared/catalog/support-catalogs";

type Executable = { execute(input?: any): Promise<any> };

export interface PersonFacilityRolesHttpUseCases {
  listPersonFacilityRoles(): Executable;
}

export function createPersonFacilityRolesRoutes(
  useCases: PersonFacilityRolesHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/person-facility-roles",
      async ({ query }) => {
        // Active only by default — this is a picker. `Administração ›
        // Catálogos` opts into the retired ones so an admin can bring one back
        // (spec 0016 §4).
        if (query.includeInactive === "true") {
          return { data: await personFacilityRoleCatalog.listAll() };
        }
        return useCases.listPersonFacilityRoles().execute();
      },
      {
        detail: {
          summary: "List the person–facility role catalog (id, name, isActive)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({ includeInactive: t.Optional(t.String()) }),
      }
    );
}

export const personFacilityRolesRoute = createPersonFacilityRolesRoutes();
