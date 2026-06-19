import { Elysia } from "elysia";
import { clinicsRoute } from "./infrastructure/routes/clinics.route";

export const clinic = new Elysia({
  name: "clinic",
  prefix: "/clinic",
  detail: {
    tags: ["Clinics"],
  },
}).use(clinicsRoute);
