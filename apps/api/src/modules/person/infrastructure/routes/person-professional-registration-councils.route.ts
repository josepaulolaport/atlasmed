import { Elysia } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";

type Executable = { execute(input?: any): Promise<any> };

export interface PersonProfessionalRegistrationCouncilsHttpUseCases {
  listPersonProfessionalRegistrationCouncils(): Executable;
}

export function createPersonProfessionalRegistrationCouncilsRoutes(
  useCases: PersonProfessionalRegistrationCouncilsHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/person-professional-registration-councils",
      async () =>
        useCases.listPersonProfessionalRegistrationCouncils().execute(),
      {
        detail: {
          summary:
            "List active professional registration councils (id, name, abbreviation)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );
}

export const personProfessionalRegistrationCouncilsRoute =
  createPersonProfessionalRegistrationCouncilsRoutes();
