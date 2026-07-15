import { afterAll, beforeAll } from 'bun:test'
import { redis } from './infrastructure/cache/redis.client'
import { cleanupTestDatabase, seedTestDatabase } from './infrastructure/database/test-seed'

/**
 * Global test setup
 * Runs once before all tests
 */
beforeAll(async () => {
  console.log('\n🧪 Setting up test environment...\n')

  try {
    await seedTestDatabase()
  } catch (error) {
    console.error('Failed to setup test environment:', error)
    throw error
  }
})

/**
 * Global test teardown
 * Runs once after all tests
 */
afterAll(async () => {
  console.log('\n🧹 Cleaning up test environment...\n')

  try {
    await redis.quit()
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
})
