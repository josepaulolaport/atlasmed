import {
  createDatabase,
  type Database,
  invitations,
  passwordResets,
  sessions,
  users
} from '@atlasmed/database'
import { ne } from 'drizzle-orm'

/**
 * Get a unique identifier for test data
 * Uses timestamp + random to avoid collisions
 */
export function getUniqueTestId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Clean all test data from database
 * Keeps only the seeded test user
 */
export async function cleanTestData(db: Database): Promise<void> {
  await db.delete(sessions)
  await db.delete(invitations)
  await db.delete(passwordResets)
  await db.delete(users).where(ne(users.email, 'test@example.com'))
}

/**
 * Get test Drizzle database client
 * Uses DATABASE_URL from environment
 */
export function getTestDatabase(): Database {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL not set')
  }

  if (!connectionString.includes('test')) {
    console.warn("⚠️  DATABASE_URL doesn't contain 'test'")
  }

  return createDatabase(connectionString)
}
