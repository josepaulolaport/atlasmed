import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { personUseCases } from "../../composition";
import { professionalCouncilCatalog } from "../../../../shared/catalog/support-catalogs";

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
      async ({ query }) => {
        // Active only by default — this is a picker. The admin catalogue asks
        // for both so a retired council can be reactivated (spec 0016 §4).
        if (query.includeInactive === "true") {
          return { data: await professionalCouncilCatalog.listAll() };
        }
        return useCases.listPersonProfessionalRegistrationCouncils().execute();
      },
      {
        detail: {
          summary:
            "List professional registration councils (id, name, abbreviation)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({ includeInactive: t.Optional(t.String()) }),
      }
    );
}

export const personProfessionalRegistrationCouncilsRoute =
  createPersonProfessionalRegistrationCouncilsRoutes();
