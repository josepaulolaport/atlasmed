import { PrismaClient } from "@atlasmed/database";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Get a unique identifier for test data
 * Uses timestamp + random to avoid collisions
 */
export function getUniqueTestId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Clean all test data from database
 * Keeps only the seeded test user
 */
export async function cleanTestData(prisma: PrismaClient): Promise<void> {
  await prisma.session.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  
  // Delete all users except the seeded test user
  await prisma.user.deleteMany({
    where: {
      email: { not: "test@example.com" },
    },
  });
}

/**
 * Get test Prisma client
 * Uses DATABASE_URL from environment
 */
export function getTestPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }
  
  if (!connectionString.includes("test")) {
    console.warn("⚠️  DATABASE_URL doesn't contain 'test'");
  }
  
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
