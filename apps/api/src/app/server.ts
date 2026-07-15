import 'dotenv/config'
import './bootstrap-telemetry'
import { logger } from '../infrastructure/logging/logger'
import { ensureStorageBuckets } from '../infrastructure/storage/bucket-provisioning'
import app from './app'
import { environment } from './config/environment'

const port = environment.PORT

async function start() {
  try {
    await ensureStorageBuckets()

    app.listen(port, () => {
      logger.info('Server started', {
        port: Number(port),
        healthUrl: `http://localhost:${port}/health`,
        metricsUrl: `http://localhost:${port}/health/metrics`
      })
    })
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

start()
