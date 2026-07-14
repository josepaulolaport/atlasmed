import type { ObservabilityLogger } from './logger'
import { CompositeLogger } from './composite-logger'
import { ConsoleLogger } from './console-logger'
import { OpenTelemetryLogger } from './open-telemetry-logger'
import { isOpenTelemetryLogsEnabled } from '../otel'

export * from './logger'

/**
 * Always logs to the console. Also ships to SigNoz/OTEL when
 * `initOpenTelemetry()` was called with log endpoints configured.
 */
export function createLogger(serviceName: string): ObservabilityLogger {
  const loggers: ObservabilityLogger[] = [new ConsoleLogger(serviceName)]

  if (isOpenTelemetryLogsEnabled()) {
    loggers.push(new OpenTelemetryLogger(serviceName, '0.1.0'))
  }

  return new CompositeLogger(loggers)
}

export const createOpenTelemetryLogger = createLogger
