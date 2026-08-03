import { Elysia } from "elysia";
import { interactionsRoute } from "./infrastructure/routes/interactions.route";

export const interactions = new Elysia({ name: "interactions", detail: { tags: ["Interactions"] } }).use(interactionsRoute);
