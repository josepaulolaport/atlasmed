import Redis from 'ioredis'
import { environment } from '../../app/config/environment'
import { logger } from '../logging/logger'

export const redis = new Redis(environment.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
    return targetErrors.some((targetError) => err.message.includes(targetError))
  }
})

redis.on('error', (err) => {
  logger.error('Redis client error', err)
})

redis.on('connect', () => {
  logger.info('Redis client connected')
})
