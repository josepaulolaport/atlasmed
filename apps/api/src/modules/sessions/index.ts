import { Elysia } from "elysia";
import { sessionsRoute } from "./infrastructure/routes/sessions.route";

export const sessions = new Elysia({
  name: "sessions",
  prefix: "/session",
})
  .use(sessionsRoute);
