import { Elysia } from "elysia";
import { catalogRoute } from "./infrastructure/routes/catalog.route";

export const catalog = new Elysia({
  name: "catalog",
  detail: {
    tags: ["Catalog"],
  },
}).use(catalogRoute);
