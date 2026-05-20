import type { ObservabilityLogger } from './logger'
import { OpenTelemetryLogger } from './open-telemetry-logger'

export * from './logger'

export function createLogger(serviceName: string): ObservabilityLogger {
  return new OpenTelemetryLogger(serviceName, '0.1.0')
}

export const createOpenTelemetryLogger = createLogger
