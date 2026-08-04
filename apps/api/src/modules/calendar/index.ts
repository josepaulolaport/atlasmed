import { Elysia } from "elysia";
import { calendarRoute } from "./infrastructure/routes/calendar.route";
export const calendar = new Elysia({ name: "calendar", detail: { tags: ["Calendar"] } }).use(calendarRoute);
