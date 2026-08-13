import { defineConfig } from "drizzle-kit";
import { environment } from "@atlasmed/config";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/schema/public/index.ts",
    "./src/schema/audit/index.ts",
    "./src/schema/ops/index.ts",
    "./src/schema/registry/index.ts",
    "./src/schema/ingestion/index.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  schemaFilter: ["public", "audit", "ops", "registry", "ingestion"],
  // Keep PostGIS system tables out of push/generate diffs.
  // extensionsFilters alone is unreliable on drizzle-kit 0.31.x — also negate via tablesFilter.
  extensionsFilters: ["postgis"],
  tablesFilter: ["!geography_columns", "!geometry_columns", "!spatial_ref_sys"],
});
