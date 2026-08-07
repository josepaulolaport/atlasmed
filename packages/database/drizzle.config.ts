import { defineConfig } from "drizzle-kit";
import { environment } from "@atlasmed/config";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/schema/public/index.ts",
    "./src/schema/audit/index.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  schemaFilter: ["public", "audit"],
  // Keep PostGIS system tables out of push/generate diffs.
  // extensionsFilters alone is unreliable on drizzle-kit 0.31.x — also negate via tablesFilter.
  extensionsFilters: ["postgis"],
  tablesFilter: ["!geography_columns", "!geometry_columns", "!spatial_ref_sys"],
});
