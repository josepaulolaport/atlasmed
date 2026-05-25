import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@atlasmed/database";

// Don't import dotenv here - let the environment be set by the runtime
// This allows tests to use .env.test and app to use .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
