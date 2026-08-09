import { Elysia } from "elysia";
import { scheduleRoutes } from "./infrastructure/routes/schedules.route";

export const schedules = new Elysia({
  name: "schedules",
  detail: { tags: ["Schedules"] },
}).use(scheduleRoutes);
