import { Elysia } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";

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
      async () => useCases.listPersonFacilityRoles().execute(),
      {
        detail: {
          summary: "List active person–facility role catalog (id, name, isActive)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );
}

export const personFacilityRolesRoute = createPersonFacilityRolesRoutes();
