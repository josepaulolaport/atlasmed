import { defineConfig } from "drizzle-kit";
import { environment } from "@atlasmed/config";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/schema/public/index.ts",
    "./src/schema/audit/index.ts",
    "./src/schema/registry/index.ts",
    "./src/schema/ingestion/index.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  schemaFilter: ["public", "audit", "registry", "ingestion"],
});
