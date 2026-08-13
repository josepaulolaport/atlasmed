import { Elysia } from "elysia";
import { healthcareProfessionalsRoute } from "./infrastructure/routes/healthcare-professionals.route";
import { healthcareSpecialtiesRoute } from "./infrastructure/routes/healthcare-specialties.route";
import { personFacilityRolesRoute } from "./infrastructure/routes/person-facility-roles.route";
import { personProfessionalRegistrationCouncilsRoute } from "./infrastructure/routes/person-professional-registration-councils.route";
import { personsRoute } from "./infrastructure/routes/persons.route";

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
  .use(personProfessionalRegistrationCouncilsRoute);
