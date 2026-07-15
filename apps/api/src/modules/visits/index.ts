import { Elysia } from "elysia";
import { visitsRoute } from "./infrastructure/routes/visits.route";

export const visits = new Elysia({ name: "visits", detail: { tags: ["Visits"] } }).use(visitsRoute);
