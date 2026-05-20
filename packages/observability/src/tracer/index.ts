import { OpenTelemetryTracer } from './open-telemetry-tracer'
import type { Tracer } from './tracer'

export * from './tracer'

export function createTracer(serviceName: string): Tracer {
  return new OpenTelemetryTracer(serviceName, '0.1.0')
}

export { OpenTelemetryTracer }
