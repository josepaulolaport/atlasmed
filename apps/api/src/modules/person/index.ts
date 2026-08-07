import { Elysia } from "elysia";
import { healthcareProfessionalsRoute } from "./infrastructure/routes/healthcare-professionals.route";
import { personsRoute } from "./infrastructure/routes/persons.route";

export { personUseCases, CLASSIFICATION } from "./composition";

export const person = new Elysia({
  name: "person",
  detail: {
    tags: ["Persons"],
  },
})
  .use(personsRoute)
  .use(healthcareProfessionalsRoute);
