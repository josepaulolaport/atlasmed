import { afterEach, describe, expect, it } from 'bun:test'
import { createLogger } from './index'
import { isOpenTelemetryLogsEnabled, shutdownOpenTelemetry } from './otel'

describe('createLogger', () => {
  afterEach(async () => {
    await shutdownOpenTelemetry()
  })

  it('always includes console output when OTEL is not configured', () => {
    expect(isOpenTelemetryLogsEnabled()).toBe(false)
    const logger = createLogger('test-service')
    expect(typeof logger.info).toBe('function')
  })
})
