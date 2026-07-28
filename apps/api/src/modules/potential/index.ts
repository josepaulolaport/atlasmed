import { Elysia } from "elysia";
import { potentialRoute } from "./infrastructure/routes/potential.route";

export const potential = new Elysia({
  name: "potential",
  detail: {
    tags: ["Potential"],
  },
}).use(potentialRoute);
