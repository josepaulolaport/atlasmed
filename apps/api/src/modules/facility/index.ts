import { Elysia } from "elysia";
import { facilitiesRoute } from "./infrastructure/routes/facilities.route";

export const facility = new Elysia({
  name: "facility",
  detail: {
    tags: ["Facilities"],
  },
}).use(facilitiesRoute);
