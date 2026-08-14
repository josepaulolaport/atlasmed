import { Elysia } from "elysia";
import { dashboardRoute } from "./infrastructure/routes/dashboard.route";
import { teamRoute } from "./infrastructure/routes/team.route";

export const dashboard = new Elysia({
  name: "dashboard",
  detail: {
    tags: ["Dashboard"],
  },
})
  .use(dashboardRoute)
  .use(teamRoute);
