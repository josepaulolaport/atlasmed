/**
 * Load test environment variables
 * This runs before test-setup.ts to ensure .env.test is loaded
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/atlasmed_test",
  REDIS_URL: "redis://localhost:6379/1",
  JWT_ACCESS_SECRET: "test-access-secret-minimum-32-characters-long",
  JWT_SECRET: "test-access-secret-minimum-32-characters-long",
  JWT_EXPIRATION: "15m",
  JWT_EXPIRES_IN: "15m",
  CORS_ORIGINS: "http://localhost:3001",
  FRONTEND_URL: "http://localhost:3001",
  RESEND_API_KEY: "re_test_key",
  TOKEN_HASH_PEPPER: "test-token-pepper-min16",
};

const result = config({
  path: resolve(__dirname, "../.env.test"),
  override: true,
});

if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
  console.error("❌ Failed to load .env.test:", result.error);
  throw result.error;
}

// Support legacy .env.test files that only define JWT_SECRET
if (!process.env.JWT_ACCESS_SECRET && process.env.JWT_SECRET) {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
}
if (!process.env.JWT_SECRET && process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_SECRET = process.env.JWT_ACCESS_SECRET;
}
if (!process.env.JWT_EXPIRES_IN && process.env.JWT_EXPIRATION) {
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRATION;
}
if (!process.env.JWT_EXPIRATION && process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRATION = process.env.JWT_EXPIRES_IN;
}

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
  process.env.JWT_ACCESS_SECRET = TEST_ENV_DEFAULTS.JWT_ACCESS_SECRET;
}

console.log("✅ Loaded test environment from .env.test");
const dbUrl = process.env.DATABASE_URL || "";
const dbParts = dbUrl.split("@")[1] || "not set";
console.log(`   DATABASE: ${dbParts}`);
console.log(`   REDIS: ${process.env.REDIS_URL || "not set"}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log("");
