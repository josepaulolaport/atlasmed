import { Elysia } from "elysia";
import { registryIngestionRoutes } from "./infrastructure/routes/registry-ingestion.route";

export const registryIngestion = new Elysia({
  name: "registry-ingestion",
  detail: {
    tags: ["Registry Ingestion"],
  },
}).use(registryIngestionRoutes);
