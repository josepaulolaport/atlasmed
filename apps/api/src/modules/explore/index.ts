import { Elysia } from "elysia";
import { exploreRoute } from "./infrastructure/routes/explore.route";

export const explore = new Elysia({
  name: "explore",
  prefix: "/explore",
  detail: {
    tags: ["Explore"],
  },
}).use(exploreRoute);
