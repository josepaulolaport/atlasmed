import { Elysia } from "elysia";
import { professionalsRoute } from "./infrastructure/routes/professionals.route";

export const professional = new Elysia({
  name: "professional",
  detail: {
    tags: ["Professionals"],
  },
}).use(professionalsRoute);
