import { Elysia } from "elysia";
import { territoriesRoute } from "./infrastructure/routes/territories.route";

export const territory = new Elysia({
  name: "territory",
  prefix: "/territory",
  detail: {
    tags: ["Territories"],
  },
}).use(territoriesRoute);

export {
  territoryHierarchyPort,
  territoryAssignmentPolicy,
  territoryRepositories,
} from "./composition";
