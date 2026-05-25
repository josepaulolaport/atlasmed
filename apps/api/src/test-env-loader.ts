/**
 * Load test environment variables
 * This runs before test-setup.ts to ensure .env.test is loaded
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.test
const result = config({
  path: resolve(__dirname, "../.env.test"),
  override: true, // Override any existing env vars
});

if (result.error) {
  console.error("❌ Failed to load .env.test:", result.error);
  throw result.error;
}

console.log("✅ Loaded test environment from .env.test");
const dbUrl = process.env.DATABASE_URL || "";
const dbParts = dbUrl.split("@")[1] || "not set";
console.log(`   DATABASE: ${dbParts}`);
console.log(`   REDIS: ${process.env.REDIS_URL || "not set"}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log("");
