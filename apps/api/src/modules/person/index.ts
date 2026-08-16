import { Elysia } from "elysia";
import { healthcareProfessionalsRoute } from "./infrastructure/routes/healthcare-professionals.route";
import { healthcareSpecialtiesRoute } from "./infrastructure/routes/healthcare-specialties.route";
import { personFacilityRolesRoute } from "./infrastructure/routes/person-facility-roles.route";
import { personProfessionalRegistrationCouncilsRoute } from "./infrastructure/routes/person-professional-registration-councils.route";
import { personsRoute } from "./infrastructure/routes/persons.route";
import { createSimpleCatalogWriteRoutes } from "../../shared/catalog/simple-catalog.route";
import {
  healthcareSpecialtyCatalog,
  personFacilityRoleCatalog,
  professionalCouncilCatalog,
} from "../../shared/catalog/support-catalogs";

export { personUseCases, CLASSIFICATION } from "./composition";

export const person = new Elysia({
  name: "person",
  detail: {
    tags: ["Persons"],
  },
})
  .use(personsRoute)
  .use(healthcareProfessionalsRoute)
  .use(healthcareSpecialtiesRoute)
  .use(personFacilityRolesRoute)
  .use(personProfessionalRegistrationCouncilsRoute)
  // Admin writes for the two person-side support catalogues (spec 0016 §5.2).
  // The reads above keep `read PERSON` because a rep needs the pickers; these
  // are `create`/`update CATALOG`, which only an ADMIN holds.
  .use(
    createSimpleCatalogWriteRoutes({
      path: "healthcare-specialties",
      resource: "HealthcareSpecialty",
      tag: "Persons",
      repository: healthcareSpecialtyCatalog,
      // The official CBO id, optional since migration `0117` — an imported
      // specialty has one, a locally-created one does not.
      extraField: { name: "cnesId" },
    })
  )
  .use(
    createSimpleCatalogWriteRoutes({
      path: "person-facility-roles",
      resource: "PersonFacilityRole",
      tag: "Persons",
      repository: personFacilityRoleCatalog,
    })
  )
  .use(
    createSimpleCatalogWriteRoutes({
      path: "person-professional-registration-councils",
      resource: "ProfessionalRegistrationCouncil",
      tag: "Persons",
      repository: professionalCouncilCatalog,
      // The abbreviation, e.g. "CRM" — NOT NULL and unique on the column.
      extraField: { name: "abbreviation", required: true },
    })
  );
