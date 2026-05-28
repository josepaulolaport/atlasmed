import { Elysia } from "elysia";
import { doctorsRoute } from "./infrastructure/routes/doctors.route";

export const doctor = new Elysia({
  name: "doctor",
  prefix: "/doctor",
  detail: {
    tags: ["Doctors"],
  },
}).use(doctorsRoute);
