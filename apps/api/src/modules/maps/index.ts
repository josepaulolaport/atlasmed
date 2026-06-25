import { Elysia } from "elysia";
import { mapsRoute } from "./infrastructure/routes/maps.route";

export const maps = new Elysia({
  name: "maps",
  prefix: "/maps",
  detail: {
    tags: ["Maps"],
  },
}).use(mapsRoute);
