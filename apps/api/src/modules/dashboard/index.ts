import { Elysia } from "elysia";
import { dashboardRoute } from "./infrastructure/routes/dashboard.route";

export const dashboard = new Elysia({
  name: "dashboard",
  detail: {
    tags: ["Dashboard"],
  },
}).use(dashboardRoute);
